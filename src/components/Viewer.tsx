import { useRef, useEffect, useMemo, useCallback } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { OrbitControls, Grid, GizmoHelper, GizmoViewport } from '@react-three/drei';
import * as THREE from 'three';
import { useForgeStore } from '../store/forgeStore';

interface ModelProps {
  geometry: THREE.BufferGeometry | null;
  wireframe: boolean;
}

function Model({ geometry, wireframe }: ModelProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const { viewerState } = useForgeStore();
  
  useFrame(() => {
    if (meshRef.current && viewerState.autoRotate) {
      meshRef.current.rotation.y += 0.005;
    }
  });
  
  if (!geometry) return null;
  
  return (
    <mesh ref={meshRef} geometry={geometry} castShadow receiveShadow>
      <meshStandardMaterial
        color="#00d9ff"
        metalness={0.3}
        roughness={0.4}
        wireframe={wireframe}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

function Axes() {
  return (
    <group>
      {/* X axis - Red */}
      <arrowHelper args={[new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0, 0), 50, 0xff4444, 5, 3]} />
      {/* Y axis - Green */}
      <arrowHelper args={[new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 0), 50, 0x44ff44, 5, 3]} />
      {/* Z axis - Blue */}
      <arrowHelper args={[new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0, 0), 50, 0x4444ff, 5, 3]} />
    </group>
  );
}

interface SceneCaptureProps {
  onCapture: (dataUrl: string, cameraPos: [number, number, number], cameraTarget: [number, number, number]) => void;
  captureRef: React.MutableRefObject<(() => void) | null>;
}

function SceneCapture({ onCapture, captureRef }: SceneCaptureProps) {
  const { gl, camera, scene } = useThree();
  
  const capture = useCallback(() => {
    gl.render(scene, camera);
    const dataUrl = gl.domElement.toDataURL('image/png');
    
    const cameraPos: [number, number, number] = [
      camera.position.x,
      camera.position.y,
      camera.position.z,
    ];
    
    // Get camera target (where it's looking)
    const target = new THREE.Vector3();
    camera.getWorldDirection(target);
    target.multiplyScalar(100).add(camera.position);
    
    const cameraTarget: [number, number, number] = [target.x, target.y, target.z];
    
    onCapture(dataUrl, cameraPos, cameraTarget);
  }, [gl, camera, scene, onCapture]);
  
  // Expose capture function via ref
  useEffect(() => {
    captureRef.current = capture;
  }, [capture, captureRef]);
  
  return null;
}

interface ViewerProps {
  onCapture?: (dataUrl: string, cameraPos: [number, number, number], cameraTarget: [number, number, number]) => void;
}

export function Viewer({ onCapture }: ViewerProps) {
  const captureRef = useRef<(() => void) | null>(null);
  
  const {
    renderResult,
    engineStatus,
    viewerState,
    updateViewerState,
  } = useForgeStore();
  
  const geometry = renderResult?.geometry ?? null;
  
  // Compute bounding box for camera positioning
  const bounds = useMemo(() => {
    if (!geometry) return { center: [0, 0, 0] as [number, number, number], size: 50 };
    
    geometry.computeBoundingBox();
    const box = geometry.boundingBox!;
    const center = new THREE.Vector3();
    const size = new THREE.Vector3();
    
    box.getCenter(center);
    box.getSize(size);
    
    return {
      center: [center.x, center.y, center.z] as [number, number, number],
      size: Math.max(size.x, size.y, size.z),
    };
  }, [geometry]);
  
  const handleCapture = useCallback(() => {
    captureRef.current?.();
  }, []);
  
  const handleCaptureData = useCallback((
    dataUrl: string,
    cameraPos: [number, number, number],
    cameraTarget: [number, number, number]
  ) => {
    onCapture?.(dataUrl, cameraPos, cameraTarget);
  }, [onCapture]);
  
  return (
    <div className="viewer-container">
      <div className="viewer-header">
        <span className="viewer-title">
          <span className="viewer-icon">◈</span>
          3D Preview
          {engineStatus.compiling && <span className="compiling-badge">Compiling...</span>}
        </span>
        <div className="viewer-controls">
          <button
            className={`control-btn ${viewerState.wireframe ? 'active' : ''}`}
            onClick={() => updateViewerState({ wireframe: !viewerState.wireframe })}
            title="Toggle Wireframe"
          >
            ⬡
          </button>
          <button
            className={`control-btn ${viewerState.showGrid ? 'active' : ''}`}
            onClick={() => updateViewerState({ showGrid: !viewerState.showGrid })}
            title="Toggle Grid"
          >
            ⊞
          </button>
          <button
            className={`control-btn ${viewerState.showAxes ? 'active' : ''}`}
            onClick={() => updateViewerState({ showAxes: !viewerState.showAxes })}
            title="Toggle Axes"
          >
            ⊕
          </button>
          <button
            className={`control-btn ${viewerState.autoRotate ? 'active' : ''}`}
            onClick={() => updateViewerState({ autoRotate: !viewerState.autoRotate })}
            title="Auto Rotate"
          >
            ↻
          </button>
          <button
            className="control-btn capture-btn"
            onClick={handleCapture}
            title="Capture for VLM"
          >
            📷
          </button>
        </div>
      </div>
      
      <div className="viewer-canvas" style={{ background: viewerState.backgroundColor }}>
        <Canvas
          camera={{
            position: [bounds.size * 1.5, bounds.size * 1.2, bounds.size * 1.5],
            fov: 50,
            near: 0.1,
            far: 10000,
          }}
          shadows
          gl={{ preserveDrawingBuffer: true }}
        >
          <SceneCapture onCapture={handleCaptureData} captureRef={captureRef} />
          
          {/* Lighting */}
          <ambientLight intensity={0.4} />
          <directionalLight
            position={[50, 50, 50]}
            intensity={1}
            castShadow
            shadow-mapSize={[2048, 2048]}
          />
          <directionalLight position={[-50, 30, -50]} intensity={0.3} />
          <pointLight position={[0, 50, 0]} intensity={0.5} />
          
          {/* Model */}
          <Model geometry={geometry} wireframe={viewerState.wireframe} />
          
          {/* Grid */}
          {viewerState.showGrid && (
            <Grid
              args={[200, 200]}
              position={[0, -bounds.size / 2 - 1, 0]}
              cellSize={10}
              cellThickness={0.5}
              cellColor="#2a2a4a"
              sectionSize={50}
              sectionThickness={1}
              sectionColor="#3a3a6a"
              fadeDistance={400}
              fadeStrength={1}
              followCamera={false}
            />
          )}
          
          {/* Axes */}
          {viewerState.showAxes && <Axes />}
          
          {/* Controls */}
          <OrbitControls
            makeDefault
            target={bounds.center}
            enableDamping
            dampingFactor={0.05}
          />
          
          {/* Gizmo */}
          <GizmoHelper alignment="bottom-right" margin={[80, 80]}>
            <GizmoViewport
              axisColors={['#ff4444', '#44ff44', '#4444ff']}
              labelColor="white"
            />
          </GizmoHelper>
        </Canvas>
        
        {/* Status overlay */}
        {renderResult?.warnings && renderResult.warnings.length > 0 && (
          <div className="viewer-warnings">
            {renderResult.warnings.map((w, i) => (
              <div key={i} className="warning-item">⚠ {w}</div>
            ))}
          </div>
        )}
        
        {renderResult?.error && (
          <div className="viewer-error">
            <span className="error-icon">✕</span>
            {renderResult.error}
          </div>
        )}
        
        {renderResult?.renderTime && (
          <div className="render-time">
            Rendered in {renderResult.renderTime.toFixed(0)}ms
          </div>
        )}
      </div>
    </div>
  );
}
