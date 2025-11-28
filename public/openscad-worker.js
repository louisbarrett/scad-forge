// OpenSCAD WASM Worker (ES Module)
// Runs OpenSCAD compilation in a separate thread
// NOTE: WASM instances CANNOT be reused after callMain() - OpenSCAD calls exit()
// which corrupts the instance state. We must create a fresh instance per compilation.
// The optimization is pre-loading the factory so subsequent instance creation is fast.

let OpenSCADFactory = null;
let factoryPromise = null;

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
  
  // Create necessary directories
  try {
    instance.FS.mkdir('/fonts');
  } catch (e) {
    // Directory might already exist
  }
  instance.FS.chdir('/');
  
  return instance;
}

// Initialize factory immediately and signal ready
// Pre-loading the factory means first render will be faster
loadFactory()
  .then(() => {
    console.log('[OpenSCAD Worker] Ready');
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
