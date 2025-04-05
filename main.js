const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

// Set canvas size
canvas.width = 800;
canvas.height = 800;
let animationID = null;

// FPS tracking variables
let frameCount = 0;
let lastTime = performance.now();
let fps = 0;
let fpsIndicator = document.querySelector("#fpsIndicator");

// Configuration
const config = {
    numSpheres: 14,
    slices: 30,
    isoLevel: 0.5,
    xRotation: Math.PI*0.0,
    centerForce: 0.0012,
    radiusMin: 10,
    radiusMax: 90,
    speedMin: 0.0,
    speedMax: 0.2,
    yMin: -400,
    yMax: 400,
    renderScale: 0.7,
    noiseIntensity: 0.35,
    fillOpacity: 1.0,  // Added opacity for the pastel fills
};

// Define 3D space boundaries
const bounds = {
    xMin: -800,
    xMax: 800,
    yMin: -800,
    yMax: 800,
    zMin: -800,
    zMax: 800,
};

// Generate pastel colors for metaballs
function generatePastelColor() {
    const hue = Math.floor(Math.random() * 360);
    const saturation = 40 + Math.random()*60;
    const lightness = 40 + Math.random()*60;
    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

// Metaball class
class Metaball {
    constructor() {
        this.x = (Math.random() * 2 - 1) * 400;
        this.y = (Math.random() * 2 - 1) * 0;
        this.z = (Math.random() * 2 - 1) * 400;
        
        this.radius = config.radiusMin + Math.random() * (config.radiusMax - config.radiusMin);
        
        // Random velocity direction
        const angle = Math.random() * Math.PI * 2;
        const speed = config.speedMin + Math.random() * (config.speedMax - config.speedMin);
        this.vx = Math.cos(angle) * speed;
        this.vy = (Math.random() * 2 - 1) * speed;
        this.vz = Math.sin(angle) * speed;
        
        // Assign a pastel color to each metaball
        this.color = generatePastelColor();
    }
    
    update() {
        // Move metaball
        this.x += this.vx;
        this.y += this.vy;
        this.z += this.vz;
        
        // Apply force toward center
        const distanceFromCenter = Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
        if (distanceFromCenter > 400) {
            const forceStrength = config.centerForce * (1 + (distanceFromCenter - 400) * 0.01);
            const forceX = -this.x * forceStrength;
            const forceY = -this.y * forceStrength;
            const forceZ = -this.z * forceStrength;
            
            this.vx += forceX;
            this.vy += forceY;
            this.vz += forceZ;
        }
    }
    
    // Calculate field value at a point
    fieldValueAt(x, y, z) {
        const dx = this.x - x;
        const dy = this.y - y;
        const dz = this.z - z;
        const distSquared = dx * dx + dy * dy + dz * dz;
        return this.radius * this.radius / Math.max(distSquared, 1);
    }
}

// Initialize metaballs
const metaballs = [];
for (let i = 0; i < config.numSpheres; i++) {
    metaballs.push(new Metaball());
}

// Marching squares algorithm with filled polygons
// Improved marching squares algorithm with filled polygons
function marchingSquares(fieldValues, level, yPos) {
    const gridSize = Math.sqrt(fieldValues.length);
    const contourSegments = [];
    const contourPolygons = [];
    
    for (let z = 0; z < gridSize - 1; z++) {
        for (let x = 0; x < gridSize - 1; x++) {
            const i = z * gridSize + x;
            
            // Get field values at the 4 corners of this cell
            const a = fieldValues[i];
            const b = fieldValues[i + 1];
            const c = fieldValues[i + gridSize];
            const d = fieldValues[i + gridSize + 1];
            
            // Determine case based on which corners are inside the isosurface
            let caseIndex = 0;
            if (a > level) caseIndex |= 1;
            if (b > level) caseIndex |= 2;
            if (c > level) caseIndex |= 4;
            if (d > level) caseIndex |= 8;
            
            // Skip if all corners are outside or all corners are inside
            if (caseIndex === 0 || caseIndex === 15) {
                // For case 15 (all inside), we should still create a filled polygon
                if (caseIndex === 15) {
                    const scaledX = x / (gridSize - 1) * (bounds.xMax - bounds.xMin) + bounds.xMin;
                    const scaledZ = z / (gridSize - 1) * (bounds.zMax - bounds.zMin) + bounds.zMin;
                    const cellSize = (bounds.xMax - bounds.xMin) / (gridSize - 1);
                    
                    // Create a quad for the fully inside cell
                    contourPolygons.push([
                        {x: scaledX, y: yPos, z: scaledZ},
                        {x: scaledX + cellSize, y: yPos, z: scaledZ},
                        {x: scaledX + cellSize, y: yPos, z: scaledZ + cellSize},
                        {x: scaledX, y: yPos, z: scaledZ + cellSize}
                    ]);
                }
                continue;
            }
            
            // Calculate cell coordinates
            const scaledX = x / (gridSize - 1) * (bounds.xMax - bounds.xMin) + bounds.xMin;
            const scaledZ = z / (gridSize - 1) * (bounds.zMax - bounds.zMin) + bounds.zMin;
            const cellSize = (bounds.xMax - bounds.xMin) / (gridSize - 1);
            
            // Calculate intersection points using linear interpolation
            const points = [];
            
            // Bottom edge (between a and b)
            if ((caseIndex & 3) === 1 || (caseIndex & 3) === 2) {
                const t = (level - a) / (b - a);
                points.push({
                    x: scaledX + t * cellSize,
                    y: yPos,
                    z: scaledZ
                });
            }
            
            // Right edge (between b and d)
            if ((caseIndex & 10) === 2 || (caseIndex & 10) === 8) {
                const t = (level - b) / (d - b);
                points.push({
                    x: scaledX + cellSize,
                    y: yPos,
                    z: scaledZ + t * cellSize
                });
            }
            
            // Top edge (between c and d)
            if ((caseIndex & 12) === 4 || (caseIndex & 12) === 8) {
                const t = (level - c) / (d - c);
                points.push({
                    x: scaledX + t * cellSize,
                    y: yPos,
                    z: scaledZ + cellSize
                });
            }
            
            // Left edge (between a and c)
            if ((caseIndex & 5) === 1 || (caseIndex & 5) === 4) {
                const t = (level - a) / (c - a);
                points.push({
                    x: scaledX,
                    y: yPos,
                    z: scaledZ + t * cellSize
                });
            }
            
            // Add line segments for the contour
            if (points.length >= 2) {
                // For the contour lines, we still connect them in pairs
                for (let p = 0; p < points.length; p += 2) {
                    if (p + 1 < points.length) {
                        contourSegments.push([points[p], points[p + 1]]);
                    }
                }
                
                // Create a polygon for filling
                if (points.length >= 3) {
                    // For cases with more than 2 points, create a polygon
                    contourPolygons.push([...points]);
                } else {
                    // For cases with exactly 2 points, include corner points that are inside
                    const insideCorners = [];
                    if (a > level) insideCorners.push({x: scaledX, y: yPos, z: scaledZ});
                    if (b > level) insideCorners.push({x: scaledX + cellSize, y: yPos, z: scaledZ});
                    if (c > level) insideCorners.push({x: scaledX, y: yPos, z: scaledZ + cellSize});
                    if (d > level) insideCorners.push({x: scaledX + cellSize, y: yPos, z: scaledZ + cellSize});
                    
                    // Create polygon(s) with the inside corners and intersection points
                    if (insideCorners.length > 0) {
                        const polygon = [...points, ...insideCorners];
                        contourPolygons.push(polygon);
                    }
                }
            }
        }
    }
    
    return { segments: contourSegments, polygons: contourPolygons };
}

// Calculate field value at a point in 3D space
function calculateFieldValue(x, y, z) {
    let value = 0;
    let dominantMetaballIndex = 0;
    let maxContribution = 0;
    
    for (let i = 0; i < metaballs.length; i++) {
        const metaball = metaballs[i];
        const contribution = metaball.fieldValueAt(x, y, z);
        value += contribution;
        
        // Track which metaball has the most influence at this point
        if (contribution > maxContribution) {
            maxContribution = contribution;
            dominantMetaballIndex = i;
        }
    }
    
    return { value, dominantMetaballIndex };
}

// Generate field values for a 2D slice at a specific y value
function generateFieldSlice(y, gridSize) {
    const fieldValues = new Array(gridSize * gridSize);
    const dominantMetaballs = new Array(gridSize * gridSize);
    
    for (let z = 0; z < gridSize; z++) {
        for (let x = 0; x < gridSize; x++) {
            const xPos = x / (gridSize - 1) * (bounds.xMax - bounds.xMin) + bounds.xMin;
            const zPos = z / (gridSize - 1) * (bounds.zMax - bounds.zMin) + bounds.zMin;
            const result = calculateFieldValue(xPos, y, zPos);
            
            fieldValues[z * gridSize + x] = result.value;
            dominantMetaballs[z * gridSize + x] = result.dominantMetaballIndex;
        }
    }
    
    return { fieldValues, dominantMetaballs };
}

// Transform 3D point to 2D screen coordinates with rotation around X axis
function transformPoint(point) {
    // Apply dynamic X rotation that slowly changes over time
    const time = performance.now() * 0.0001;
    const dynamicRotation = config.xRotation + Math.sin(time) * Math.PI;
    
    const rotY = point.y * Math.cos(dynamicRotation) - point.z * Math.sin(dynamicRotation);
    const rotZ = point.y * Math.sin(dynamicRotation) + point.z * Math.cos(dynamicRotation);
    
    // Project to 2D (simple orthographic projection)
    const scale = config.renderScale;
    const screenX = canvas.width / 2 + point.x * scale;
    const screenY = canvas.height / 2 + rotZ * scale;
    
    return { x: screenX, y: screenY };
}

// Create noise texture
function createNoiseTexture() {
    const noiseCanvas = document.createElement('canvas');
    noiseCanvas.width = canvas.width;
    noiseCanvas.height = canvas.height;
    const noiseCtx = noiseCanvas.getContext('2d');
    
    const imageData = noiseCtx.createImageData(canvas.width, canvas.height);
    const data = imageData.data;
    
    for (let i = 0; i < data.length; i += 4) {
        const value = Math.floor(Math.random() * 255);
        data[i] = value;
        data[i + 1] = value;
        data[i + 2] = value;
        data[i + 3] = 255;
    }
    
    noiseCtx.putImageData(imageData, 0, 0);
    return noiseCanvas;
}

const noiseTexture = createNoiseTexture();

// Main render function
function render() {
    // Track FPS
    frameCount++;
    const currentTime = performance.now();
    const elapsedTime = currentTime - lastTime;
    
    if (elapsedTime >= 1000) {
        fps = Math.round((frameCount * 1000) / elapsedTime);
        frameCount = 0;
        lastTime = currentTime;
    }
    fpsIndicator.textContent = "FPS: "+fps;
    
    // Clear canvas
    ctx.fillStyle = '#f0eadc';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Update metaballs
    for (const metaball of metaballs) {
        metaball.update();
    }
    
    // Generate and render slices
    const gridSize = 90; // Resolution of the grid
    ctx.lineWidth = 1.5;
    
    // Create a time-based value for color shifting
    const time = performance.now() * 0.0001;
    
    // Start from the back (bottom slices) to handle depth properly
    for (let i = 0; i < config.slices; i++) {
        const y = config.yMin + (config.yMax - config.yMin) * (i / (config.slices - 1));
        
        // Generate field values for this slice
        const { fieldValues, dominantMetaballs } = generateFieldSlice(y, gridSize);
        
        // Apply marching squares to get contour lines and polygons
        const { segments: contourSegments, polygons: contourPolygons } = marchingSquares(fieldValues, config.isoLevel, y);
        
        // Render contour polys with pastel colors
        const depthFactor = i / (config.slices - 1);

        // First render the filled polygons
        ctx.globalAlpha = config.fillOpacity * (0.6 + depthFactor * 0.4); // Opacity increases with depth

        for (const polygon of contourPolygons) {
            // Find the dominant metaball for this polygon by checking the center point
            let avgX = 0, avgY = y, avgZ = 0;
            for (const point of polygon) {
                avgX += point.x;
                avgZ += point.z;
            }
            avgX /= polygon.length;
            avgZ /= polygon.length;
            
            // Get the dominant metaball by directly calculating field values
            let maxContribution = 0;
            let dominantIdx = 0;
            
            for (let j = 0; j < metaballs.length; j++) {
                const contribution = metaballs[j].fieldValueAt(avgX, avgY, avgZ);
                if (contribution > maxContribution) {
                    maxContribution = contribution;
                    dominantIdx = j;
                }
            }
            
            // Use the metaball's color
            ctx.fillStyle = metaballs[dominantIdx].color;
            
            // Draw the filled polygon
            ctx.beginPath();
            const p0 = transformPoint(polygon[0]);
            ctx.moveTo(p0.x, p0.y);
            
            for (let j = 1; j < polygon.length; j++) {
                const p = transformPoint(polygon[j]);
                ctx.lineTo(p.x, p.y);
            }
            
            ctx.closePath();
            ctx.fill();
        }      
        // Reset alpha for the outlines
        ctx.globalAlpha = 1.0;
        ctx.strokeStyle = `rgb(0, 0, 0)`;

        // Adjust line width based on depth for more visual interest
        ctx.lineWidth = 0.0 + depthFactor * 10;
        
        // Then render the outline segments
        for (const segment of contourSegments) {
            const p1 = transformPoint(segment[0]);
            const p2 = transformPoint(segment[1]);
            
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();
        }
    }
    
    // Apply noise texture
    ctx.globalAlpha = config.noiseIntensity;
    ctx.globalCompositeOperation = 'multiply';
    ctx.drawImage(noiseTexture, 0, 0);
    
    // Reset alpha and composite operation
    ctx.globalAlpha = 1.0;
    ctx.globalCompositeOperation = 'source-over';
}

// Set up dat.GUI controls
function setupGUI() {
    const gui = new dat.GUI();
    
    // Animation controls
    const animationFolder = gui.addFolder('Animation');
    animationFolder.add(config, 'numSpheres', 1, 30).step(1).onChange(restartAnimation);
    animationFolder.add(config, 'slices', 5, 60).step(1);
    animationFolder.add(config, 'xRotation', 0, Math.PI * 2).step(0.01);
    animationFolder.add(config, 'renderScale', 0.1, 2.0).step(0.05);
    animationFolder.open();
    
    // Metaball controls
    const metaballFolder = gui.addFolder('Spheres');
    metaballFolder.add(config, 'radiusMin', 5, 50).step(1).onChange(restartAnimation);
    metaballFolder.add(config, 'radiusMax', 50, 200).step(1).onChange(restartAnimation);
    metaballFolder.add(config, 'speedMin', 0.0, 0.5).step(0.01).onChange(restartAnimation);
    metaballFolder.add(config, 'speedMax', 0.0, 1.0).step(0.01).onChange(restartAnimation);
    metaballFolder.add(config, 'centerForce', 0.0001, 0.005).step(0.0001);
    metaballFolder.open();
    
    // Rendering controls
    const renderFolder = gui.addFolder('Rendering');
    renderFolder.add(config, 'isoLevel', 0.1, 1.5).step(0.01);
    renderFolder.add(config, 'yMin', -800, 0).step(10);
    renderFolder.add(config, 'yMax', 0, 800).step(10);
    renderFolder.add(config, 'noiseIntensity', 0, 1).step(0.01);
    renderFolder.add(config, 'fillOpacity', 0, 1).step(0.01);
    
    // Add a button to randomize colors
    renderFolder.add({
        randomizeColors: function() {
            for (const metaball of metaballs) {
                metaball.color = generatePastelColor();
            }
        }
    }, 'randomizeColors').name('Randomize Colors');
    
    renderFolder.open();
    
    // Add reset button
    gui.add({
        resetDefaults: function() {
            // Store original config values
            const defaultConfig = {
                numSpheres: 14,
                slices: 30,
                isoLevel: 0.5,
                xRotation: Math.PI*0.0,
                centerForce: 0.0012,
                radiusMin: 10,
                radiusMax: 90,
                speedMin: 0.0,
                speedMax: 0.2,
                yMin: -400,
                yMax: 400,
                renderScale: 0.7,
                noiseIntensity: 0.35,
                fillOpacity: 1.0,
            };
            
            // Reset all values
            Object.keys(defaultConfig).forEach(key => {
                config[key] = defaultConfig[key];
            });
            
            // Update GUI controllers
            for (let i = 0; i < gui.__controllers.length; i++) {
                gui.__controllers[i].updateDisplay();
            }
            
            // Update folder controllers
            [animationFolder, metaballFolder, renderFolder].forEach(folder => {
                for (let i = 0; i < folder.__controllers.length; i++) {
                    folder.__controllers[i].updateDisplay();
                }
            });
            
            // Restart animation with default settings
            restartAnimation();
        }
    }, 'resetDefaults').name('Reset to Defaults');
}

// Start animation
setupGUI();
restartAnimation();