// OpenSCAD WASM Worker (ES Module)
// Runs OpenSCAD compilation in a separate thread

let OpenSCADFactory = null;
let factoryPromise = null;

// Load the OpenSCAD factory function once
async function loadFactory() {
  if (OpenSCADFactory) return OpenSCADFactory;
  if (factoryPromise) return factoryPromise;
  
  factoryPromise = (async () => {
    try {
      const module = await import('/openscad.js');
      OpenSCADFactory = module.default || module.OpenSCAD || module;
      console.log('OpenSCAD factory loaded');
      return OpenSCADFactory;
    } catch (e) {
      console.error('Failed to load OpenSCAD factory:', e);
      throw new Error('Failed to load OpenSCAD WASM: ' + e);
    }
  })();
  
  return factoryPromise;
}

// Create a fresh OpenSCAD instance for each compilation
// This avoids the "program has already aborted" issue
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
loadFactory()
  .then(() => {
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
    instance = await createInstance();
    
    // Write the input file
    const inputPath = '/input.scad';
    const outputPath = '/output.' + format;
    
    instance.FS.writeFile(inputPath, code);
    
    // Build command line arguments
    const args = [
      inputPath,
      '-o', outputPath,
      '--backend=manifold',
    ];
    
    if (format === 'stl') {
      args.push('--export-format=binstl');
    }
    
    console.log('OpenSCAD args:', args);
    
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
