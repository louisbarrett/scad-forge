// OpenSCAD WASM Worker (ES Module)
// Runs OpenSCAD compilation in a separate thread
// NOTE: WASM instances CANNOT be reused after callMain() - OpenSCAD calls exit()
// which corrupts the instance state. We must create a fresh instance per compilation.
// The optimization is pre-loading the factory so subsequent instance creation is fast.

let OpenSCADFactory = null;
let factoryPromise = null;
let fontsCache = null; // Cache loaded font data

// Liberation fonts bundled with the app - these are open source fonts
// that OpenSCAD can use for text() operations
const FONT_FILES = [
  'LiberationSans-Regular.ttf',
  'LiberationSans-Bold.ttf',
  'LiberationSans-Italic.ttf',
  'LiberationSans-BoldItalic.ttf',
  'LiberationMono-Regular.ttf',
  'LiberationMono-Bold.ttf',
  'LiberationSerif-Regular.ttf',
  'LiberationSerif-Bold.ttf',
];

// Load fonts from public/fonts/ and cache them
async function loadFonts() {
  if (fontsCache) return fontsCache;
  
  console.log('[OpenSCAD Worker] Loading fonts...');
  const fonts = {};
  
  await Promise.all(
    FONT_FILES.map(async (filename) => {
      try {
        const response = await fetch(`/fonts/${filename}`);
        if (response.ok) {
          const buffer = await response.arrayBuffer();
          fonts[filename] = new Uint8Array(buffer);
          console.log(`[OpenSCAD Worker] Loaded font: ${filename}`);
        } else {
          console.warn(`[OpenSCAD Worker] Font not found: ${filename}`);
        }
      } catch (e) {
        console.warn(`[OpenSCAD Worker] Failed to load font ${filename}:`, e);
      }
    })
  );
  
  fontsCache = fonts;
  return fonts;
}

// Load the OpenSCAD factory function once - this is the expensive part
// Subsequent instance creation is much faster once the factory is loaded
async function loadFactory() {
  if (OpenSCADFactory) return OpenSCADFactory;
  if (factoryPromise) return factoryPromise;
  
  factoryPromise = (async () => {
    try {
      console.log('[OpenSCAD Worker] Loading WASM factory...');
      const startTime = performance.now();
      const module = await import('/openscad.js');
      OpenSCADFactory = module.default || module.OpenSCAD || module;
      const elapsed = performance.now() - startTime;
      console.log(`[OpenSCAD Worker] Factory loaded in ${elapsed.toFixed(0)}ms`);
      return OpenSCADFactory;
    } catch (e) {
      console.error('[OpenSCAD Worker] Failed to load factory:', e);
      throw new Error('Failed to load OpenSCAD WASM: ' + e);
    }
  })();
  
  return factoryPromise;
}

// Create a fresh OpenSCAD instance - must be done for each compilation
// Once the factory is loaded, this is relatively fast (~50-100ms vs ~500ms first time)
async function createInstance() {
  const factory = await loadFactory();
  const fonts = await loadFonts();
  
  const instance = await factory({
    noInitialRun: true,
    locateFile: (path) => {
      if (path.endsWith('.wasm')) {
        return '/openscad.wasm';
      }
      return path;
    },
    print: (text) => {
      self.postMessage({ type: 'stdout', text });
    },
    printErr: (text) => {
      self.postMessage({ type: 'stderr', text });
    },
  });
  
  // Create font directories - OpenSCAD looks in several standard locations
  const fontDirs = [
    '/fonts',
    '/usr/share/fonts',
    '/usr/share/fonts/truetype',
    '/usr/share/fonts/truetype/liberation',
    '/home/web_user/.fonts',
  ];
  
  for (const dir of fontDirs) {
    try {
      // Create directory hierarchy
      const parts = dir.split('/').filter(Boolean);
      let path = '';
      for (const part of parts) {
        path += '/' + part;
        try {
          instance.FS.mkdir(path);
        } catch (e) {
          // Directory might already exist
        }
      }
    } catch (e) {
      // Ignore errors
    }
  }
  
  // Load bundled fonts into multiple locations for maximum compatibility
  for (const [filename, data] of Object.entries(fonts)) {
    const locations = [
      `/fonts/${filename}`,
      `/usr/share/fonts/truetype/liberation/${filename}`,
      `/home/web_user/.fonts/${filename}`,
    ];
    
    for (const loc of locations) {
      try {
        instance.FS.writeFile(loc, data);
      } catch (e) {
        // Ignore errors for individual locations
      }
    }
  }
  
  console.log(`[OpenSCAD Worker] Fonts installed to virtual filesystem`);
  
  // Set environment variables for OpenSCAD to find fonts
  if (instance.ENV) {
    instance.ENV['OPENSCAD_FONT_PATH'] = '/fonts:/usr/share/fonts/truetype/liberation';
    instance.ENV['HOME'] = '/home/web_user';
  }
  
  instance.FS.chdir('/');
  
  return instance;
}

// Initialize factory and fonts immediately and signal ready
// Pre-loading the factory and fonts means first render will be faster
Promise.all([loadFactory(), loadFonts()])
  .then(() => {
    console.log('[OpenSCAD Worker] Ready (factory and fonts loaded)');
    self.postMessage({ type: 'ready' });
  })
  .catch((e) => {
    self.postMessage({ type: 'error', error: String(e) });
  });

self.addEventListener('message', async (e) => {
  const { code, format } = e.data;
  const start = performance.now();
  
  let instance = null;
  
  try {
    // Create a fresh instance for each compilation
    // This is required because callMain() corrupts the instance state
    instance = await createInstance();
    const instanceTime = performance.now() - start;
    console.log(`[OpenSCAD Worker] Instance created in ${instanceTime.toFixed(0)}ms`);
    
    // Write the input file
    const inputPath = '/input.scad';
    const outputPath = '/output.' + format;
    
    instance.FS.writeFile(inputPath, code);
    
    // Build command line arguments
    // Using manifold backend for fastest CSG operations
    const args = [
      inputPath,
      '-o', outputPath,
      '--backend=manifold',
    ];
    
    if (format === 'stl') {
      args.push('--export-format=binstl');
    }
    
    console.log('[OpenSCAD Worker] Running with args:', args.join(' '));
    
    // Run OpenSCAD
    let exitCode;
    try {
      exitCode = instance.callMain(args);
    } catch (err) {
      if (typeof err === 'number' && instance.formatException) {
        throw new Error(instance.formatException(err));
      }
      throw err;
    }
    
    const elapsedMillis = performance.now() - start;
    
    if (exitCode !== 0) {
      self.postMessage({
        type: 'result',
        result: {
          success: false,
          error: 'OpenSCAD exited with code ' + exitCode,
          stdout: [],
          stderr: [],
          elapsedMillis: elapsedMillis,
        },
      });
      return;
    }
    
    // Read output file
    let output;
    try {
      output = instance.FS.readFile(outputPath);
    } catch (err) {
      self.postMessage({
        type: 'result',
        result: {
          success: false,
          error: 'Failed to read output file: ' + err,
          stdout: [],
          stderr: [],
          elapsedMillis: elapsedMillis,
        },
      });
      return;
    }
    
    console.log(`[OpenSCAD Worker] Compilation completed in ${elapsedMillis.toFixed(0)}ms`);
    
    self.postMessage({
      type: 'result',
      result: {
        success: true,
        output: output,
        stdout: [],
        stderr: [],
        elapsedMillis: elapsedMillis,
      },
    });
    
  } catch (err) {
    const elapsedMillis = performance.now() - start;
    console.error('[OpenSCAD Worker] Error:', err);
    self.postMessage({
      type: 'result',
      result: {
        success: false,
        error: String(err),
        stdout: [],
        stderr: [],
        elapsedMillis: elapsedMillis,
      },
    });
  }
});
