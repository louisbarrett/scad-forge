// OFF Parser - converts OpenSCAD OFF output to THREE.js BufferGeometry

import * as THREE from 'three';

export interface Vertex {
  x: number;
  y: number;
  z: number;
}

export interface Face {
  vertices: number[];
  color?: [number, number, number, number];
}

export interface ParsedOFF {
  vertices: Vertex[];
  faces: Face[];
}

/**
 * Parse OFF (Object File Format) content into vertices and faces
 */
export function parseOFF(content: string): ParsedOFF {
  const lines = content
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0 && !line.startsWith('#'));
  
  if (lines.length === 0) {
    throw new Error('Empty OFF file');
  }
  
  let currentLine = 0;
  let counts: string;
  
  // Parse header
  if (lines[0].match(/^OFF(\s|$)/)) {
    counts = lines[0].substring(3).trim();
    currentLine = 1;
  } else if (lines[0] === 'OFF' && lines.length > 1) {
    counts = lines[1];
    currentLine = 2;
  } else {
    throw new Error('Invalid OFF file: missing OFF header');
  }
  
  // Handle case where counts are empty (on next line)
  if (!counts && currentLine < lines.length) {
    counts = lines[currentLine];
    currentLine++;
  }
  
  const [numVertices, numFaces] = counts.split(/\s+/).map(Number);
  
  if (isNaN(numVertices) || isNaN(numFaces)) {
    throw new Error('Invalid OFF file: invalid vertex or face counts');
  }
  
  if (currentLine + numVertices + numFaces > lines.length) {
    throw new Error('Invalid OFF file: not enough lines');
  }
  
  // Parse vertices
  const vertices: Vertex[] = [];
  for (let i = 0; i < numVertices; i++) {
    const parts = lines[currentLine + i].split(/\s+/).map(Number);
    if (parts.length < 3 || parts.some(isNaN)) {
      throw new Error(`Invalid OFF file: invalid vertex at line ${currentLine + i + 1}`);
    }
    vertices.push({ x: parts[0], y: parts[1], z: parts[2] });
  }
  currentLine += numVertices;
  
  // Parse faces
  const faces: Face[] = [];
  for (let i = 0; i < numFaces; i++) {
    const parts = lines[currentLine + i].split(/\s+/).map(Number);
    const numVerts = parts[0];
    const faceVertices = parts.slice(1, numVerts + 1);
    
    // Optional color (RGBA as 0-255 values)
    let color: [number, number, number, number] | undefined;
    if (parts.length >= numVerts + 4) {
      color = [
        parts[numVerts + 1] / 255,
        parts[numVerts + 2] / 255,
        parts[numVerts + 3] / 255,
        parts.length >= numVerts + 5 ? parts[numVerts + 4] / 255 : 1,
      ];
    }
    
    if (faceVertices.length < 3) {
      throw new Error(`Invalid OFF file: face at line ${currentLine + i + 1} must have at least 3 vertices`);
    }
    
    faces.push({ vertices: faceVertices, color });
  }
  
  return { vertices, faces };
}

/**
 * Convert parsed OFF data to THREE.js BufferGeometry
 * 
 * Note: OpenSCAD uses Z-up coordinate system, Three.js uses Y-up.
 * We apply the coordinate transformation here: (x, y, z) -> (x, z, -y)
 * This is equivalent to rotating -90 degrees around the X axis.
 */
export function offToBufferGeometry(parsed: ParsedOFF): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  
  // Triangulate faces and build arrays
  const positions: number[] = [];
  const colors: number[] = [];
  const hasColors = parsed.faces.some(f => f.color !== undefined);
  
  // Default color (yellow-ish, like OpenSCAD default)
  const defaultColor: [number, number, number] = [0.98, 0.84, 0.17];
  
  // Helper to convert from OpenSCAD Z-up to Three.js Y-up
  // Rotation of -90° around X axis: (x, y, z) -> (x, z, -y)
  const convertCoords = (v: Vertex): [number, number, number] => [v.x, v.z, -v.y];
  
  for (const face of parsed.faces) {
    const faceColor = face.color 
      ? [face.color[0], face.color[1], face.color[2]] 
      : defaultColor;
    
    // Triangulate polygon (fan triangulation)
    for (let i = 1; i < face.vertices.length - 1; i++) {
      const v0 = parsed.vertices[face.vertices[0]];
      const v1 = parsed.vertices[face.vertices[i]];
      const v2 = parsed.vertices[face.vertices[i + 1]];
      
      // Add triangle vertices (converted to Y-up coordinate system)
      positions.push(...convertCoords(v0));
      positions.push(...convertCoords(v1));
      positions.push(...convertCoords(v2));
      
      // Add colors for each vertex
      if (hasColors) {
        colors.push(...faceColor);
        colors.push(...faceColor);
        colors.push(...faceColor);
      }
    }
  }
  
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  
  if (hasColors) {
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  }
  
  // Compute normals for proper lighting
  geometry.computeVertexNormals();
  
  return geometry;
}

/**
 * Parse OFF content and convert directly to THREE.js BufferGeometry
 */
export function parseOFFToGeometry(content: string): THREE.BufferGeometry {
  const parsed = parseOFF(content);
  return offToBufferGeometry(parsed);
}

/**
 * Parse OFF from Uint8Array (as returned by OpenSCAD WASM)
 */
export function parseOFFBytesToGeometry(data: Uint8Array): THREE.BufferGeometry {
  const content = new TextDecoder().decode(data);
  return parseOFFToGeometry(content);
}

