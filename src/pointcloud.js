import * as dat from "lil-gui";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

/**
 * Scene setup
 */
const canvas = document.querySelector("canvas.webgl");
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);

/**
 * Screen resolution
 */
const sizes = {
	width: window.innerWidth,
	height: window.innerHeight,
};

window.addEventListener("resize", () => {
	sizes.width = window.innerWidth;
	sizes.height = window.innerHeight;

	camera.aspect = sizes.width / sizes.height;
	camera.updateProjectionMatrix();

	renderer.setSize(sizes.width, sizes.height);
	renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
});

/**
 * Camera
 */
const camera = new THREE.PerspectiveCamera(
	75,
	sizes.width / sizes.height,
	0.1,
	100
);
camera.position.set(4, 4, 4);
scene.add(camera);

/**
 * Controls
 */
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;

/**
 * Renderer
 */
const renderer = new THREE.WebGLRenderer({
	canvas: canvas,
	antialias: true,
});
renderer.setSize(sizes.width, sizes.height);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

/**
 * Pointcloud creation
 */
let pointCloud = null;

// Control parameters
const params = {
	pointSize: 2.0,
	animationSpeed: 1.0,
	waveAmplitude: 0.1,
	waveFrequency: 5.0,
	rotationSpeed: 0.1,
	colorHue: 0.5,
	colorSaturation: 1.0,
	colorLightness: 0.5,
	glowIntensity: 2.0,
	particleCount: 1.0,
};

// Function to create pointcloud from geometry
function createPointCloud(geometry) {
	// Get vertices from geometry
	const vertices = geometry.attributes.position.array;
	const originalParticleCount = vertices.length / 3;
	const particleCount = Math.floor(
		originalParticleCount * params.particleCount
	);

	// Create geometry for points
	const particlesGeometry = new THREE.BufferGeometry();

	// Create positions array
	const positions = new Float32Array(particleCount * 3);
	const colors = new Float32Array(particleCount * 3);
	const sizes = new Float32Array(particleCount);
	const randomValues = new Float32Array(particleCount);

	for (let i = 0; i < particleCount; i++) {
		const i3 = i * 3;
		const vertexIndex = Math.floor(Math.random() * originalParticleCount) * 3;

		// Copy positions
		positions[i3] = vertices[vertexIndex];
		positions[i3 + 1] = vertices[vertexIndex + 1];
		positions[i3 + 2] = vertices[vertexIndex + 2];

		// Set colors based on parameters
		const color = new THREE.Color();
		color.setHSL(
			params.colorHue + Math.random() * 0.2 - 0.1,
			params.colorSaturation,
			params.colorLightness
		);
		colors[i3] = color.r;
		colors[i3 + 1] = color.g;
		colors[i3 + 2] = color.b;

		// Set random sizes
		sizes[i] = (Math.random() * 0.5 + 0.5) * params.pointSize;
		randomValues[i] = Math.random();
	}

	particlesGeometry.setAttribute(
		"position",
		new THREE.BufferAttribute(positions, 3)
	);
	particlesGeometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
	particlesGeometry.setAttribute("size", new THREE.BufferAttribute(sizes, 1));
	particlesGeometry.setAttribute(
		"aRandom",
		new THREE.BufferAttribute(randomValues, 1)
	);

	// Create custom shader material for points
	const pointsMaterial = new THREE.ShaderMaterial({
		uniforms: {
			time: { value: 0.0 },
			pixelRatio: { value: renderer.getPixelRatio() },
			animationSpeed: { value: params.animationSpeed },
			waveAmplitude: { value: params.waveAmplitude },
			waveFrequency: { value: params.waveFrequency },
			glowIntensity: { value: params.glowIntensity },
		},
		vertexShader: `
            uniform float time;
            uniform float pixelRatio;
            uniform float animationSpeed;
            uniform float waveAmplitude;
            uniform float waveFrequency;
            
            attribute float size;
            attribute float aRandom;
            
            varying vec3 vColor;
            varying float vRandom;
            
            void main() {
                vColor = color;
                vRandom = aRandom;
                
                vec3 pos = position;
                
                // Add wave animation
                pos.y += sin(time * animationSpeed + position.x * waveFrequency + aRandom * 10.0) * waveAmplitude;
                pos.x += cos(time * animationSpeed + position.z * waveFrequency + aRandom * 10.0) * waveAmplitude * 0.5;
                pos.z += sin(time * animationSpeed + position.y * waveFrequency + aRandom * 10.0) * waveAmplitude * 0.3;
                
                vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
                
                gl_PointSize = size * pixelRatio * (300.0 / -mvPosition.z);
                gl_Position = projectionMatrix * mvPosition;
            }
        `,
		fragmentShader: `
            uniform float glowIntensity;
            
            varying vec3 vColor;
            varying float vRandom;
            
            void main() {
                // Create circular points
                float distanceToCenter = distance(gl_PointCoord, vec2(0.5));
                if (distanceToCenter > 0.5) {
                    discard;
                }
                
                // Add glow effect with controllable intensity
                float alpha = 1.0 - distanceToCenter * 2.0;
                alpha = pow(alpha, 2.0);
                
                // Add some random flickering
                float flicker = 0.8 + 0.2 * sin(vRandom * 100.0);
                
                vec3 finalColor = vColor * glowIntensity * flicker;
                gl_FragColor = vec4(finalColor, alpha);
            }
        `,
		blending: THREE.AdditiveBlending,
		transparent: true,
		vertexColors: true,
		depthWrite: false,
	});

	// Create points
	const points = new THREE.Points(particlesGeometry, pointsMaterial);
	return points;
}

/**
 * Load model and create pointcloud
 */
let currentGeometry = null;
const loader = new GLTFLoader();

// Function to regenerate pointcloud
function regeneratePointCloud() {
	if (pointCloud) {
		scene.remove(pointCloud);
		pointCloud.geometry.dispose();
		pointCloud.material.dispose();
	}

	if (currentGeometry) {
		pointCloud = createPointCloud(currentGeometry);
		pointCloud.scale.set(2, 2, 2);
		scene.add(pointCloud);
	}
}

loader.load("statue.glb", (gltf) => {
	// Get the first mesh from the loaded model
	const mesh = gltf.scene.children[0];

	if (mesh && mesh.geometry) {
		currentGeometry = mesh.geometry;
		regeneratePointCloud();
	}
});

// Alternative: Create pointcloud from basic geometry if model doesn't load
const fallbackGeometry = new THREE.SphereGeometry(2, 64, 32);

// Add fallback after a delay to see if model loads
setTimeout(() => {
	if (!pointCloud) {
		currentGeometry = fallbackGeometry;
		regeneratePointCloud();
	}
}, 2000);

/**
 * Lighting (for reference, though points don't need it)
 */
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
directionalLight.position.set(1, 1, 0);
scene.add(directionalLight);

/**
 * GUI Controls
 */
const gui = new dat.GUI();

// Point appearance controls
const pointFolder = gui.addFolder("Point Appearance");
pointFolder
	.add(params, "pointSize", 0.1, 5.0, 0.1)
	.name("Point Size")
	.onChange(() => {
		if (pointCloud && pointCloud.material.uniforms) {
			regeneratePointCloud();
		}
	});
pointFolder
	.add(params, "glowIntensity", 0.1, 5.0, 0.1)
	.name("Glow Intensity")
	.onChange((value) => {
		if (pointCloud && pointCloud.material.uniforms) {
			pointCloud.material.uniforms.glowIntensity.value = value;
		}
	});
pointFolder
	.add(params, "particleCount", 0.1, 1.0, 0.05)
	.name("Particle Density")
	.onChange(() => {
		regeneratePointCloud();
	});
pointFolder.open();

// Color controls
const colorFolder = gui.addFolder("Colors");
colorFolder
	.add(params, "colorHue", 0.0, 1.0, 0.01)
	.name("Hue")
	.onChange(() => {
		regeneratePointCloud();
	});
colorFolder
	.add(params, "colorSaturation", 0.0, 1.0, 0.01)
	.name("Saturation")
	.onChange(() => {
		regeneratePointCloud();
	});
colorFolder
	.add(params, "colorLightness", 0.0, 1.0, 0.01)
	.name("Lightness")
	.onChange(() => {
		regeneratePointCloud();
	});
colorFolder.open();

// Animation controls
const animationFolder = gui.addFolder("Animation");
animationFolder
	.add(params, "animationSpeed", 0.0, 3.0, 0.1)
	.name("Animation Speed")
	.onChange((value) => {
		if (pointCloud && pointCloud.material.uniforms) {
			pointCloud.material.uniforms.animationSpeed.value = value;
		}
	});
animationFolder
	.add(params, "waveAmplitude", 0.0, 0.5, 0.01)
	.name("Wave Amplitude")
	.onChange((value) => {
		if (pointCloud && pointCloud.material.uniforms) {
			pointCloud.material.uniforms.waveAmplitude.value = value;
		}
	});
animationFolder
	.add(params, "waveFrequency", 1.0, 20.0, 0.5)
	.name("Wave Frequency")
	.onChange((value) => {
		if (pointCloud && pointCloud.material.uniforms) {
			pointCloud.material.uniforms.waveFrequency.value = value;
		}
	});
animationFolder
	.add(params, "rotationSpeed", -0.5, 0.5, 0.01)
	.name("Rotation Speed");
animationFolder.open();

// Presets
const presetFolder = gui.addFolder("Presets");
presetFolder.add(
	{
		"Calm Waves": () => {
			params.animationSpeed = 0.5;
			params.waveAmplitude = 0.05;
			params.waveFrequency = 3.0;
			params.rotationSpeed = 0.05;
			params.glowIntensity = 1.5;
			updateAllControls();
		},
	},
	"Calm Waves"
);
presetFolder.add(
	{
		Energetic: () => {
			params.animationSpeed = 2.0;
			params.waveAmplitude = 0.2;
			params.waveFrequency = 10.0;
			params.rotationSpeed = 0.2;
			params.glowIntensity = 3.0;
			updateAllControls();
		},
	},
	"Energetic"
);
presetFolder.add(
	{
		Minimal: () => {
			params.animationSpeed = 0.2;
			params.waveAmplitude = 0.01;
			params.waveFrequency = 1.0;
			params.rotationSpeed = 0.01;
			params.glowIntensity = 1.0;
			updateAllControls();
		},
	},
	"Minimal"
);

function updateAllControls() {
	gui
		.controllersRecursive()
		.forEach((controller) => controller.updateDisplay());
	if (pointCloud && pointCloud.material.uniforms) {
		pointCloud.material.uniforms.animationSpeed.value = params.animationSpeed;
		pointCloud.material.uniforms.waveAmplitude.value = params.waveAmplitude;
		pointCloud.material.uniforms.waveFrequency.value = params.waveFrequency;
		pointCloud.material.uniforms.glowIntensity.value = params.glowIntensity;
	}
}

/**
 * Animation
 */
const clock = new THREE.Clock();

const tick = () => {
	const elapsedTime = clock.getElapsedTime();

	// Update controls
	controls.update();

	// Update point cloud animation
	if (pointCloud && pointCloud.material.uniforms) {
		pointCloud.material.uniforms.time.value = elapsedTime;

		// Rotate the point cloud using the controllable rotation speed
		pointCloud.rotation.y = elapsedTime * params.rotationSpeed;
		pointCloud.rotation.x = Math.sin(elapsedTime * 0.05) * 0.2;
	}

	// Render
	renderer.render(scene, camera);

	// Call tick again on the next frame
	window.requestAnimationFrame(tick);
};

tick();
