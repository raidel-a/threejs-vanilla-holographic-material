import heic2any from "heic2any";
import * as dat from "lil-gui";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

console.log("Starting Image Pointcloud Demo...");

/**
 * Scene setup
 */
const canvas = document.querySelector("canvas.webgl");
console.log("Canvas element:", canvas);
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
camera.position.set(0, 0, 5);
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
 * Parameters
 */
const params = {
	pointSize: 0.2,
	animationSpeed: 1.0,
	depthMultiplier: 0.5,
	brightnessThreshold: 0.1,
	colorMode: "original", // 'original', 'brightness', 'rainbow'
	waveAmplitude: 0.1,
	rotationSpeed: 0.0,
	imageScale: 4.0,
	particleDensity: 1.0,
	// New multi-image parameters
	transitionSpeed: 1.0,
	currentImageIndex: 0,
	autoTransition: false,
	transitionMode: "morph", // 'morph', 'dissolve', 'slide'
};

/**
 * Multi-image management
 */
let transitionState = {
	isTransitioning: false,
	progress: 0,
	fromIndex: 0,
	toIndex: 0,
	startTime: 0,
	maxDuration: 5.0, // Maximum 5 seconds for any transition
};

/**
 * Image pointcloud creation
 */
let pointCloud = null;
let loadedImages = []; // Array to store multiple image data
let currentImageIndex = 0;

function createImagePointcloud(
	imageDataArray,
	width,
	height,
	blendData = null,
	blendFactor = 0
) {
	// Store the image data for regeneration
	if (!blendData) {
		// Single image mode - update stored data
		const currentImage = loadedImages[params.currentImageIndex];
		if (currentImage) {
			currentImage.data = new Uint8ClampedArray(imageDataArray);
			currentImage.width = width;
			currentImage.height = height;
		}
	}

	if (pointCloud) {
		scene.remove(pointCloud);
		pointCloud.geometry.dispose();
		pointCloud.material.dispose();
	}

	const totalPixels = width * height;

	// Use probabilistic sampling for smooth particle density scaling
	// This eliminates the jumping effect by using random sampling
	const useProbabilisticSampling = params.particleDensity < 1.0;

	let stepSize = 1; // Always check every pixel

	// Estimate maximum particles for array allocation
	const estimatedParticles = useProbabilisticSampling
		? Math.floor(totalPixels * params.particleDensity * 1.2) // Add 20% buffer for probabilistic
		: totalPixels;
	const maxParticles = Math.min(estimatedParticles, totalPixels);

	const positions = new Float32Array(maxParticles * 3);
	const colors = new Float32Array(maxParticles * 3);
	const sizes = new Float32Array(maxParticles);
	const brightness = new Float32Array(maxParticles);

	let particleIndex = 0;

	for (let y = 0; y < height; y += stepSize) {
		for (let x = 0; x < width; x += stepSize) {
			if (particleIndex >= maxParticles) break;

			// Probabilistic sampling for smooth density control
			if (useProbabilisticSampling && Math.random() > params.particleDensity) {
				continue; // Skip this pixel based on probability
			}

			const pixelIndex = (y * width + x) * 4;
			const r1 = imageDataArray[pixelIndex] / 255;
			const g1 = imageDataArray[pixelIndex + 1] / 255;
			const b1 = imageDataArray[pixelIndex + 2] / 255;
			const alpha1 = imageDataArray[pixelIndex + 3] / 255;

			let r = r1,
				g = g1,
				b = b1,
				alpha = alpha1;
			let pixelBrightness = (r1 + g1 + b1) / 3;

			// If blending with another image
			if (blendData && blendFactor > 0) {
				const r2 = blendData[pixelIndex] / 255;
				const g2 = blendData[pixelIndex + 1] / 255;
				const b2 = blendData[pixelIndex + 2] / 255;
				const alpha2 = blendData[pixelIndex + 3] / 255;

				// Linear interpolation between images
				r = r1 * (1 - blendFactor) + r2 * blendFactor;
				g = g1 * (1 - blendFactor) + g2 * blendFactor;
				b = b1 * (1 - blendFactor) + b2 * blendFactor;
				alpha = alpha1 * (1 - blendFactor) + alpha2 * blendFactor;

				const brightness2 = (r2 + g2 + b2) / 3;
				pixelBrightness =
					pixelBrightness * (1 - blendFactor) + brightness2 * blendFactor;
			}

			// Calculate brightness
			// const pixelBrightness = (r + g + b) / 3;

			// Skip pixels below brightness threshold
			if (pixelBrightness < params.brightnessThreshold || alpha < 0.1) {
				continue;
			}

			// Position (center the image) with validation
			const xPos = ((x - width / 2) / 100) * params.imageScale;
			const yPos = (-(y - height / 2) / 100) * params.imageScale;
			const zPos = pixelBrightness * params.depthMultiplier;

			// Validate positions to prevent NaN
			positions[particleIndex * 3] = isNaN(xPos) ? 0 : xPos;
			positions[particleIndex * 3 + 1] = isNaN(yPos) ? 0 : yPos;
			positions[particleIndex * 3 + 2] = isNaN(zPos) ? 0 : zPos;

			// Colors based on mode
			if (params.colorMode === "original") {
				colors[particleIndex * 3] = r;
				colors[particleIndex * 3 + 1] = g;
				colors[particleIndex * 3 + 2] = b;
			} else if (params.colorMode === "brightness") {
				colors[particleIndex * 3] = pixelBrightness;
				colors[particleIndex * 3 + 1] = pixelBrightness;
				colors[particleIndex * 3 + 2] = pixelBrightness;
			} else if (params.colorMode === "rainbow") {
				const hue = pixelBrightness * 0.8 + 0.1;
				const color = new THREE.Color();
				color.setHSL(hue, 0.8, 0.6);
				colors[particleIndex * 3] = color.r;
				colors[particleIndex * 3 + 1] = color.g;
				colors[particleIndex * 3 + 2] = color.b;
			}

			// Size based on brightness with validation
			const pointSize = params.pointSize * (0.5 + pixelBrightness * 0.5);
			sizes[particleIndex] = isNaN(pointSize) ? 1.0 : pointSize;
			brightness[particleIndex] = isNaN(pixelBrightness)
				? 0.5
				: pixelBrightness;

			particleIndex++;
		}
		if (particleIndex >= maxParticles) break;
	}

	// Create geometry
	const geometry = new THREE.BufferGeometry();

	// Final validation of position data
	const finalPositions = positions.slice(0, particleIndex * 3);
	for (let i = 0; i < finalPositions.length; i++) {
		if (isNaN(finalPositions[i])) {
			console.warn(
				`Found NaN in final positions at index ${i}, replacing with 0`
			);
			finalPositions[i] = 0;
		}
	}

	geometry.setAttribute(
		"position",
		new THREE.BufferAttribute(finalPositions, 3)
	);
	geometry.setAttribute(
		"color",
		new THREE.BufferAttribute(colors.slice(0, particleIndex * 3), 3)
	);
	geometry.setAttribute(
		"size",
		new THREE.BufferAttribute(sizes.slice(0, particleIndex), 1)
	);
	geometry.setAttribute(
		"aBrightness",
		new THREE.BufferAttribute(brightness.slice(0, particleIndex), 1)
	);

	// Create material
	const material = new THREE.ShaderMaterial({
		uniforms: {
			time: { value: 0.0 },
			pixelRatio: { value: renderer.getPixelRatio() },
			animationSpeed: { value: params.animationSpeed },
			waveAmplitude: { value: params.waveAmplitude },
		},
		vertexShader: `
            uniform float time;
            uniform float pixelRatio;
            uniform float animationSpeed;
            uniform float waveAmplitude;
            
            attribute float size;
            attribute float aBrightness;
            
            varying vec3 vColor;
            varying float vBrightness;
            
            void main() {
                vColor = color;
                vBrightness = aBrightness;
                
                vec3 pos = position;
                
                // Add wave animation based on brightness
                pos.z += sin(time * animationSpeed + pos.x * 2.0 + pos.y * 2.0) * waveAmplitude * aBrightness;
                
                vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
                
                gl_PointSize = size * pixelRatio * (300.0 / -mvPosition.z);
                gl_Position = projectionMatrix * mvPosition;
            }
        `,
		fragmentShader: `
            varying vec3 vColor;
            varying float vBrightness;
            
            void main() {
                // Create circular points
                float distanceToCenter = distance(gl_PointCoord, vec2(0.5));
                if (distanceToCenter > 0.5) {
                    discard;
                }
                
                // Add glow effect
                float alpha = 1.0 - distanceToCenter * 2.0;
                alpha = pow(alpha, 1.5);
                
                // Enhance brightness
                vec3 finalColor = vColor * (1.0 + vBrightness);
                gl_FragColor = vec4(finalColor, alpha * vBrightness);
            }
        `,
		blending: THREE.AdditiveBlending,
		transparent: true,
		vertexColors: true,
		depthWrite: false,
	});

	pointCloud = new THREE.Points(geometry, material);
	scene.add(pointCloud);

	console.log(
		`Created pointcloud with ${particleIndex} particles from ${width}x${height} image`
	);
	console.log(
		`Step size: ${stepSize}, Density: ${params.particleDensity}, Estimated max: ${maxParticles}`
	);
}

/**
 * Image loading
 */

// Function to check if file is HEIC
function isHEICFile(file) {
	const heicExtensions = [".heic", ".heif"];
	const fileName = file.name.toLowerCase();
	return (
		heicExtensions.some((ext) => fileName.endsWith(ext)) ||
		file.type === "image/heic" ||
		file.type === "image/heif"
	);
}

// Function to convert HEIC to JPEG
async function convertHEICToJPEG(file) {
	try {
		console.log("Converting HEIC file to JPEG...");
		const convertedBlob = await heic2any({
			blob: file,
			toType: "image/jpeg",
			quality: 0.8,
		});

		// heic2any might return an array, so handle both cases
		const blob = Array.isArray(convertedBlob)
			? convertedBlob[0]
			: convertedBlob;
		console.log("HEIC conversion successful");
		return blob;
	} catch (error) {
		console.error("HEIC conversion failed:", error);
		throw error;
	}
}

function loadImage(file) {
	console.log("Loading image file:", file.name, file.type);

	// Check if it's a HEIC file and convert it first
	if (isHEICFile(file)) {
		console.log("HEIC file detected, converting...");
		convertHEICToJPEG(file)
			.then((convertedBlob) => {
				// Create a new File object from the converted blob
				const convertedFile = new File(
					[convertedBlob],
					file.name.replace(/\.(heic|heif)$/i, ".jpg"),
					{
						type: "image/jpeg",
					}
				);
				loadRegularImage(convertedFile);
			})
			.catch((error) => {
				console.error("Failed to convert HEIC file:", error);
				alert("Failed to convert HEIC file. Please try a different format.");
			});
	} else {
		loadRegularImage(file);
	}
}

function loadRegularImage(file) {
	const reader = new FileReader();
	reader.onload = function (e) {
		console.log("File read successful, creating image...");
		const img = new Image();

		img.onload = function () {
			console.log("Image loaded successfully:", img.width, "x", img.height);

			// Create canvas to get image data
			const canvas = document.createElement("canvas");
			const ctx = canvas.getContext("2d");

			// Scale down large images for performance
			const maxSize = 200;
			let { width, height } = img;

			if (width > maxSize || height > maxSize) {
				const scale = Math.min(maxSize / width, maxSize / height);
				width = Math.floor(width * scale);
				height = Math.floor(height * scale);
				console.log("Scaling image to:", width, "x", height);
			}

			canvas.width = width;
			canvas.height = height;

			ctx.drawImage(img, 0, 0, width, height);
			const imageData = ctx.getImageData(0, 0, width, height);

			console.log("Creating pointcloud from uploaded image...");
			addImageToCollection(
				imageData.data,
				width,
				height,
				file.name || "uploaded-image"
			);
		};

		img.onerror = function () {
			console.error("Failed to load image");
		};

		img.src = e.target.result;
	};

	reader.onerror = function () {
		console.error("Failed to read file");
	};

	reader.readAsDataURL(file);
}

// File input handler - DISABLED (now using GUI upload)
// setTimeout(() => {
// 	const imageInput = document.getElementById("imageInput");
// 	console.log("Image input element found:", imageInput);

// 	if (imageInput) {
// 		imageInput.addEventListener("change", (e) => {
// 			console.log("File input changed, files:", e.target.files);
// 			const files = Array.from(e.target.files);

// 			if (files.length > 0) {
// 				console.log(`Processing ${files.length} files`);

// 				files.forEach((file, index) => {
// 					if (file.type.startsWith("image/") || isHEICFile(file)) {
// 						console.log(
// 							`Loading file ${index + 1}/${files.length}:`,
// 							file.name
// 						);
// 						loadImage(file);
// 					} else {
// 						console.log(`Skipping non-image file: ${file.name}`);
// 					}
// 				});

// 				if (
// 					files.some(
// 						(file) => !file.type.startsWith("image/") && !isHEICFile(file)
// 					)
// 				) {
// 					alert(
// 						"Some files were skipped. Please select only image files (JPG, PNG, GIF, WEBP, HEIC, etc.)"
// 					);
// 				}
// 			} else {
// 				console.log("No files selected");
// 			}
// 		});
// 	} else {
// 		console.error("Could not find image input element!");
// 	}
// }, 100);

// Add drag and drop functionality
const dropZone = document.body;
dropZone.addEventListener("dragover", (e) => {
	e.preventDefault();
	e.stopPropagation();
});

dropZone.addEventListener("drop", (e) => {
	e.preventDefault();
	e.stopPropagation();

	const files = e.dataTransfer.files;
	console.log("Files dropped:", files);

	if (files.length > 0) {
		const file = files[0];
		if (file.type.startsWith("image/") || isHEICFile(file)) {
			console.log("Processing dropped image:", file.name);
			loadImage(file);
		} else {
			console.log("Dropped file is not an image:", file.type);
			alert("Please drop an image file (JPG, PNG, GIF, WEBP, HEIC, etc.)");
		}
	}
});

// Default image loading removed - no longer loading sample image
// const loader = new THREE.TextureLoader();
// console.log("Loading default image...");
// loader.load(
// 	"digital_painting_golden_hour_sunset.jpg",
// 	(texture) => {
// 		console.log("Default image loaded successfully:", texture);
// 		const canvas = document.createElement("canvas");
// 		const ctx = canvas.getContext("2d");

// 		// Create image from texture
// 		const img = texture.image;
// 		const maxSize = 150;
// 		let { width, height } = img;

// 		if (width > maxSize || height > maxSize) {
// 			const scale = Math.min(maxSize / width, maxSize / height);
// 			width *= scale;
// 			height *= scale;
// 		}

// 		canvas.width = width;
// 		canvas.height = height;
// 		ctx.drawImage(img, 0, 0, width, height);

// 		const imageData = ctx.getImageData(0, 0, width, height);
// 		console.log("Adding default image to collection");
// 		addImageToCollection(imageData.data, width, height, 'default-sunset.jpg');
// 	},
// 	(progress) => {
// 		console.log("Loading progress:", progress);
// 	},
// 	(error) => {
// 		console.error("Failed to load default image:", error);
// 		// Create a simple fallback pointcloud
// 		console.log("Creating fallback pointcloud...");
// 		createFallbackPointcloud();
// 	}
// );

/**
 * GUI Controls
 */
const gui = new dat.GUI();

// Function to update image selector options
let imageController = null;
let imageFolder = null;
function updateImageSelector() {
	console.log(`Updating image selector. Total images: ${loadedImages.length}`);

	try {
		// Remove existing controller properly
		if (
			imageController &&
			imageFolder &&
			typeof imageFolder.remove === "function"
		) {
			imageFolder.remove(imageController);
			imageController = null;
		}

		// Create or get the image folder
		if (!imageFolder) {
			imageFolder = gui.addFolder("Image Selection");
			console.log("Created Image Selection folder");
		}

		if (loadedImages.length > 1) {
			const imageOptions = {};
			loadedImages.forEach((img, index) => {
				imageOptions[img.filename || `Image ${index + 1}`] = index;
			});

			console.log("Image options for selector:", imageOptions);

			imageController = imageFolder
				.add(params, "currentImageIndex", imageOptions)
				.name("Current Image")
				.onChange((value) => {
					console.log(
						`Image selector changed to: ${value} (currently transitioning: ${transitionState.isTransitioning})`
					);
					if (!transitionState.isTransitioning) {
						transitionToImage(parseInt(value));
					}
				});

			imageFolder.open();
			console.log(
				"Image selector updated with",
				Object.keys(imageOptions).length,
				"options"
			);
		} else {
			console.log("Not enough images (need > 1) to show selector");
		}
	} catch (error) {
		console.warn("Error updating image selector:", error);
		// Continue without the image selector if there's an error
	}
}

// Appearance
const appearanceFolder = gui.addFolder("Appearance");
appearanceFolder
	.add(params, "pointSize", 0.01, 2.0, 0.01)
	.name("Point Size")
	.onChange(() => {
		console.log("Point Size changed, regenerating...");
		regeneratePointcloud();
	});
appearanceFolder
	.add(params, "imageScale", 0.5, 5.0, 0.1)
	.name("Image Scale")
	.onChange(() => {
		console.log("Image Scale changed, regenerating...");
		regeneratePointcloud();
	});
appearanceFolder
	.add(params, "depthMultiplier", 0.0, 2.0, 0.1)
	.name("Depth Effect")
	.onChange(() => {
		console.log("Depth Effect changed, regenerating...");
		regeneratePointcloud();
	});
appearanceFolder
	.add(params, "brightnessThreshold", 0.0, 1.0, 0.01)
	.name("Brightness Filter")
	.onChange(() => {
		console.log("Brightness Filter changed, regenerating...");
		regeneratePointcloud();
	});
appearanceFolder
	.add(params, "particleDensity", 0.01, 1.0, 0.01)
	.name("Particle Density")
	.onChange(() => {
		console.log("Particle Density changed, regenerating...");
		regeneratePointcloud();
	});
appearanceFolder.open();

// Multi-image controls
const multiImageFolder = gui.addFolder("Multiple Images");
multiImageFolder
	.add(params, "transitionSpeed", 0.1, 5.0, 0.1)
	.name("Transition Speed");
multiImageFolder.add(params, "autoTransition").name("Auto Transition");
multiImageFolder
	.add(params, "transitionMode", ["morph", "dissolve", "slide"])
	.name("Transition Mode");

// Add buttons for navigation
multiImageFolder.add(
	{
		"Previous Image": () => {
			console.log("Previous Image button clicked");

			// Reset transition state if stuck
			if (transitionState.isTransitioning) {
				console.log("Resetting stuck transition state");
				transitionState.isTransitioning = false;
			}

			if (loadedImages.length > 1) {
				const prevIndex =
					(params.currentImageIndex - 1 + loadedImages.length) %
					loadedImages.length;
				console.log(`Transitioning to previous image: ${prevIndex}`);
				transitionToImage(prevIndex);
			} else {
				console.log("Not enough images for previous navigation");
			}
		},
	},
	"Previous Image"
);

multiImageFolder.add(
	{
		"Next Image": () => {
			console.log("Next Image button clicked");

			// Reset transition state if stuck
			if (transitionState.isTransitioning) {
				console.log("Resetting stuck transition state");
				transitionState.isTransitioning = false;
			}

			if (loadedImages.length > 1) {
				const nextIndex = (params.currentImageIndex + 1) % loadedImages.length;
				console.log(`Transitioning to next image: ${nextIndex}`);
				transitionToImage(nextIndex);
			} else {
				console.log("Not enough images for next navigation");
			}
		},
	},
	"Next Image"
);

multiImageFolder.add(
	{
		"Reset Transition": () => {
			console.log("Resetting transition state manually");
			transitionState.isTransitioning = false;
			transitionState.progress = 0;
			console.log(
				"Transition state reset. Current image index:",
				params.currentImageIndex
			);
		},
	},
	"Reset Transition"
);

multiImageFolder.add(
	{
		"Clear All Images": () => {
			console.log("Clearing all images");
			loadedImages = [];
			if (pointCloud) {
				scene.remove(pointCloud);
				pointCloud.geometry.dispose();
				pointCloud.material.dispose();
				pointCloud = null;
			}
			// Recreate fallback pointcloud
			createFallbackPointcloud();
			updateImageSelector();

			params.currentImageIndex = 0;
			console.log("Cleared all images");
		},
	},
	"Clear All Images"
);

multiImageFolder.add(
	{
		"Remove Current Image": () => {
			console.log("Removing current image");
			if (loadedImages.length > 1) {
				const currentFilename =
					loadedImages[params.currentImageIndex]?.filename;
				console.log(`Removing image: ${currentFilename}`);

				// Remove current image from array
				loadedImages.splice(params.currentImageIndex, 1);

				// Adjust current index if needed
				if (params.currentImageIndex >= loadedImages.length) {
					params.currentImageIndex = loadedImages.length - 1;
				}

				// Update display
				if (loadedImages.length > 0) {
					const currentImage = loadedImages[params.currentImageIndex];
					createImagePointcloud(
						currentImage.data,
						currentImage.width,
						currentImage.height
					);
				} else {
					// No images left, show fallback
					createFallbackPointcloud();
					params.currentImageIndex = 0;
				}

				// Update GUI
				updateImageSelector();
			} else if (loadedImages.length === 1) {
				// Remove the last image
				console.log("Removing last image");
				loadedImages = [];
				createFallbackPointcloud();
				updateImageSelector();
				params.currentImageIndex = 0;
			} else {
				console.log("No images to remove");
			}
		},
	},
	"Remove Current Image"
);

// Add GUI-based file upload
multiImageFolder.add(
	{
		"Upload Images": () => {
			// Create a hidden file input element
			const fileInput = document.createElement("input");
			fileInput.type = "file";
			fileInput.multiple = true;
			fileInput.accept = "image/*,.heic,.heif";
			fileInput.style.display = "none";

			// Add event listener for file selection
			fileInput.addEventListener("change", (e) => {
				console.log("GUI upload - File input changed, files:", e.target.files);
				const files = Array.from(e.target.files);

				if (files.length > 0) {
					console.log(`GUI upload - Processing ${files.length} files`);

					files.forEach((file, index) => {
						if (file.type.startsWith("image/") || isHEICFile(file)) {
							console.log(
								`GUI upload - Loading file ${index + 1}/${files.length}:`,
								file.name
							);
							loadImage(file);
						} else {
							console.log(`GUI upload - Skipping non-image file: ${file.name}`);
						}
					});

					if (
						files.some(
							(file) => !file.type.startsWith("image/") && !isHEICFile(file)
						)
					) {
						alert(
							"Some files were skipped. Please select only image files (JPG, PNG, GIF, WEBP, HEIC, etc.)"
						);
					}
				} else {
					console.log("GUI upload - No files selected");
				}

				// Clean up the temporary input
				document.body.removeChild(fileInput);
			});

			// Add to body temporarily and trigger click
			document.body.appendChild(fileInput);
			fileInput.click();
		},
	},
	"Upload Images"
);

// Colors
const colorFolder = gui.addFolder("Colors");
colorFolder
	.add(params, "colorMode", ["original", "brightness", "rainbow"])
	.name("Color Mode")
	.onChange(() => {
		regeneratePointcloud();
	});

// Animation
const animationFolder = gui.addFolder("Animation");
animationFolder
	.add(params, "animationSpeed", 0.0, 3.0, 0.1)
	.name("Wave Speed")
	.onChange((value) => {
		if (pointCloud) pointCloud.material.uniforms.animationSpeed.value = value;
	});
animationFolder
	.add(params, "waveAmplitude", 0.0, 0.5, 0.01)
	.name("Wave Amplitude")
	.onChange((value) => {
		if (pointCloud) pointCloud.material.uniforms.waveAmplitude.value = value;
	});
animationFolder
	.add(params, "rotationSpeed", -0.5, 0.5, 0.01)
	.name("Rotation Speed");

function regeneratePointcloud() {
	console.log(
		`regeneratePointcloud called - loadedImages: ${loadedImages.length}, currentIndex: ${params.currentImageIndex}`
	);
	if (loadedImages.length > 0) {
		const currentImage = loadedImages[params.currentImageIndex];
		if (currentImage) {
			console.log(
				`Regenerating pointcloud for image: ${currentImage.filename}`
			);
			createImagePointcloud(
				currentImage.data,
				currentImage.width,
				currentImage.height
			);
		} else {
			console.log(
				`No current image found at index ${params.currentImageIndex}`
			);
		}
	} else {
		console.log("No loaded images available for regeneration");
	}
}

// Function to add image to collection
function addImageToCollection(imageDataArray, width, height, filename = "") {
	console.log(
		`Adding image to collection: ${filename}, size: ${width}x${height}`
	);

	const imageInfo = {
		data: new Uint8ClampedArray(imageDataArray), // Copy the data
		width: width,
		height: height,
		filename: filename,
	};

	loadedImages.push(imageInfo);
	console.log(
		`Added image ${filename} to collection. Total images: ${loadedImages.length}`
	);
	console.log(
		"All loaded images:",
		loadedImages.map((img) => img.filename)
	);

	// Update GUI if it exists
	updateImageSelector();

	// If this is the first image, create the pointcloud
	if (loadedImages.length === 1) {
		params.currentImageIndex = 0;
		regeneratePointcloud();
	}

	return loadedImages.length - 1; // Return index of added image
}

// Create a fallback pointcloud if no images can be loaded
function createFallbackPointcloud() {
	console.log("Creating fallback sphere pointcloud...");

	// Create a simple sphere pointcloud
	const particleCount = 1000;
	const positions = new Float32Array(particleCount * 3);
	const colors = new Float32Array(particleCount * 3);
	const sizes = new Float32Array(particleCount);

	for (let i = 0; i < particleCount; i++) {
		// Random sphere distribution with validation
		let theta = Math.random() * Math.PI * 2;
		let phi = Math.acos(Math.random() * 2 - 1);
		let radius = 1 + Math.random() * 0.5;

		// Ensure values are valid numbers
		if (isNaN(theta)) theta = 0;
		if (isNaN(phi)) phi = 0;
		if (isNaN(radius)) radius = 1;

		let x = radius * Math.sin(phi) * Math.cos(theta);
		let y = radius * Math.sin(phi) * Math.sin(theta);
		let z = radius * Math.cos(phi);

		// Validate positions
		if (isNaN(x)) x = 0;
		if (isNaN(y)) y = 0;
		if (isNaN(z)) z = 0;

		positions[i * 3] = x;
		positions[i * 3 + 1] = y;
		positions[i * 3 + 2] = z;

		// Random colors with validation
		const color = new THREE.Color();
		const hue = Math.random();
		color.setHSL(isNaN(hue) ? 0 : hue, 0.8, 0.6);
		colors[i * 3] = color.r;
		colors[i * 3 + 1] = color.g;
		colors[i * 3 + 2] = color.b;

		const size = Math.random() * 2 + 1;
		sizes[i] = isNaN(size) ? 1 : size;
	}

	// Validate the entire arrays
	for (let i = 0; i < positions.length; i++) {
		if (isNaN(positions[i])) {
			console.warn(`Found NaN at positions[${i}], replacing with 0`);
			positions[i] = 0;
		}
	}

	// Create geometry
	const geometry = new THREE.BufferGeometry();
	geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
	geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
	geometry.setAttribute("size", new THREE.BufferAttribute(sizes, 1));

	// Create material
	const material = new THREE.ShaderMaterial({
		uniforms: {
			time: { value: 0.0 },
			pixelRatio: { value: renderer.getPixelRatio() },
		},
		vertexShader: `
			uniform float time;
			uniform float pixelRatio;
			attribute float size;
			varying vec3 vColor;
			
			void main() {
				vColor = color;
				vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
				gl_PointSize = size * pixelRatio * (300.0 / -mvPosition.z);
				gl_Position = projectionMatrix * mvPosition;
			}
		`,
		fragmentShader: `
			varying vec3 vColor;
			
			void main() {
				float distanceToCenter = distance(gl_PointCoord, vec2(0.5));
				if (distanceToCenter > 0.5) discard;
				gl_FragColor = vec4(vColor, 1.0);
			}
		`,
		transparent: true,
		vertexColors: true,
		depthWrite: false,
	});

	if (pointCloud) {
		scene.remove(pointCloud);
		pointCloud.geometry.dispose();
		pointCloud.material.dispose();
	}

	pointCloud = new THREE.Points(geometry, material);
	scene.add(pointCloud);
	console.log("Fallback pointcloud created successfully");
}

// Helper function to resize image data to target dimensions
function resizeImageData(
	imageData,
	sourceWidth,
	sourceHeight,
	targetWidth,
	targetHeight
) {
	// Create canvas for source image
	const sourceCanvas = document.createElement("canvas");
	const sourceCtx = sourceCanvas.getContext("2d");
	sourceCanvas.width = sourceWidth;
	sourceCanvas.height = sourceHeight;

	// Put source image data into canvas
	const sourceImageData = new ImageData(
		new Uint8ClampedArray(imageData),
		sourceWidth,
		sourceHeight
	);
	sourceCtx.putImageData(sourceImageData, 0, 0);

	// Create target canvas
	const targetCanvas = document.createElement("canvas");
	const targetCtx = targetCanvas.getContext("2d");
	targetCanvas.width = targetWidth;
	targetCanvas.height = targetHeight;

	// Fill with black background first
	targetCtx.fillStyle = "black";
	targetCtx.fillRect(0, 0, targetWidth, targetHeight);

	// Calculate positioning to center the image
	const scaleX = targetWidth / sourceWidth;
	const scaleY = targetHeight / sourceHeight;
	const scale = Math.min(scaleX, scaleY); // Maintain aspect ratio

	const scaledWidth = sourceWidth * scale;
	const scaledHeight = sourceHeight * scale;
	const x = (targetWidth - scaledWidth) / 2;
	const y = (targetHeight - scaledHeight) / 2;

	// Draw the resized image
	targetCtx.drawImage(sourceCanvas, x, y, scaledWidth, scaledHeight);

	// Get the resized image data
	const resizedImageData = targetCtx.getImageData(
		0,
		0,
		targetWidth,
		targetHeight
	);
	return resizedImageData.data;
}

// Function to transition between images
function transitionToImage(toIndex) {
	console.log(`transitionToImage called with toIndex: ${toIndex}`);
	console.log(
		`Current state - toIndex: ${toIndex}, currentImageIndex: ${params.currentImageIndex}, loadedImages.length: ${loadedImages.length}`
	);

	if (toIndex < 0 || toIndex >= loadedImages.length) {
		console.log(
			`Transition cancelled: toIndex ${toIndex} is out of bounds (0-${
				loadedImages.length - 1
			})`
		);
		return;
	}

	if (toIndex === params.currentImageIndex) {
		console.log(`Transition cancelled: already showing image ${toIndex}`);
		return;
	}

	if (transitionState.isTransitioning) {
		console.log("Already transitioning, ignoring new transition request");
		return;
	}

	transitionState.isTransitioning = true;
	transitionState.progress = 0;
	transitionState.fromIndex = params.currentImageIndex;
	transitionState.toIndex = toIndex;
	transitionState.startTime = clock.getElapsedTime();

	console.log(
		`Starting transition from image ${transitionState.fromIndex} (${
			loadedImages[transitionState.fromIndex]?.filename
		}) to ${transitionState.toIndex} (${
			loadedImages[transitionState.toIndex]?.filename
		})`
	);
}

/**
 * Animation
 */
const clock = new THREE.Clock();

const tick = () => {
	const elapsedTime = clock.getElapsedTime();
	let deltaTime = clock.getDelta();

	// Fix for stuck transitions: ensure minimum deltaTime
	if (deltaTime < 0.001) {
		deltaTime = 0.016; // Default to ~60fps (16ms)
	}

	// Update controls
	controls.update();

	// Handle image transitions
	if (transitionState.isTransitioning && loadedImages.length > 1) {
		const oldProgress = transitionState.progress;
		const transitionDuration = elapsedTime - transitionState.startTime;

		// Safety check: force complete if transition takes too long
		if (transitionDuration > transitionState.maxDuration) {
			console.log(
				`Transition timeout after ${transitionDuration.toFixed(
					2
				)}s, forcing completion`
			);
			transitionState.progress = 1.0;
		} else {
			transitionState.progress += deltaTime * params.transitionSpeed;
		}

		console.log(
			`Transition progress: ${oldProgress.toFixed(
				3
			)} -> ${transitionState.progress.toFixed(
				3
			)} (deltaTime: ${deltaTime.toFixed(3)}, speed: ${
				params.transitionSpeed
			}, duration: ${transitionDuration.toFixed(2)}s)`
		);

		if (transitionState.progress >= 1.0) {
			// Transition complete
			transitionState.progress = 1.0;
			transitionState.isTransitioning = false;
			params.currentImageIndex = transitionState.toIndex;

			console.log(
				`Transition COMPLETED! Now showing image ${params.currentImageIndex}`
			);

			// Don't recreate the GUI, just update the current value
			// updateImageSelector(); // This might be causing issues

			// Create final pointcloud with target image
			const targetImage = loadedImages[transitionState.toIndex];
			createImagePointcloud(
				targetImage.data,
				targetImage.width,
				targetImage.height
			);

			console.log(
				`Final pointcloud created for image: ${targetImage.filename}`
			);
		} else {
			// In transition - blend images
			const fromImage = loadedImages[transitionState.fromIndex];
			const toImage = loadedImages[transitionState.toIndex];

			// Only log progress every 10% to reduce spam
			const progressPercent = Math.floor(transitionState.progress * 10) * 10;
			const oldProgressPercent = Math.floor(oldProgress * 10) * 10;
			if (progressPercent !== oldProgressPercent) {
				console.log(`Transition progress: ${progressPercent}%`);
			}

			if (
				params.transitionMode === "morph" ||
				params.transitionMode === "dissolve"
			) {
				// For proper blending, both images need to be processed to the same dimensions
				const targetWidth = Math.max(fromImage.width, toImage.width);
				const targetHeight = Math.max(fromImage.height, toImage.height);

				// Resize and center both images to the same dimensions
				const fromImageData = resizeImageData(
					fromImage.data,
					fromImage.width,
					fromImage.height,
					targetWidth,
					targetHeight
				);
				const toImageData = resizeImageData(
					toImage.data,
					toImage.width,
					toImage.height,
					targetWidth,
					targetHeight
				);

				// Create blended pointcloud
				createImagePointcloud(
					fromImageData,
					targetWidth,
					targetHeight,
					toImageData,
					transitionState.progress
				);
			} else if (params.transitionMode === "slide") {
				// For slide transition, alternate between images quickly
				const currentImage =
					transitionState.progress < 0.5 ? fromImage : toImage;
				createImagePointcloud(
					currentImage.data,
					currentImage.width,
					currentImage.height
				);
			}
		}
	}

	// Auto transition
	if (
		params.autoTransition &&
		!transitionState.isTransitioning &&
		loadedImages.length > 1
	) {
		// Auto transition every 5 seconds
		if (
			Math.floor(elapsedTime) % 5 === 0 &&
			Math.floor(elapsedTime) !== Math.floor(elapsedTime - deltaTime)
		) {
			const nextIndex = (params.currentImageIndex + 1) % loadedImages.length;
			transitionToImage(nextIndex);
		}
	}

	// Update animations
	if (pointCloud) {
		pointCloud.material.uniforms.time.value = elapsedTime;
		pointCloud.rotation.y = elapsedTime * params.rotationSpeed;
	}

	// Render
	renderer.render(scene, camera);
	window.requestAnimationFrame(tick);
};

// Load default image function
async function loadDefaultImage() {
	try {
		// Try multiple possible paths for the default image
		const possiblePaths = [
			"./static/digital_painting_golden_hour_sunset.jpg",
			"/static/digital_painting_golden_hour_sunset.jpg",
			"../static/digital_painting_golden_hour_sunset.jpg",
			"./static/background.jpg",
			"/static/background.jpg",
			"../static/background.jpg",
		];

		for (const imagePath of possiblePaths) {
			try {
				await new Promise((resolve, reject) => {
					const img = new Image();
					img.crossOrigin = "anonymous";

					img.onload = () => {
						console.log(`Default image loaded successfully from: ${imagePath}`);
						// Process the default image
						const canvas = document.createElement("canvas");
						const ctx = canvas.getContext("2d");
						canvas.width = img.width;
						canvas.height = img.height;
						ctx.drawImage(img, 0, 0);

						// Get image data
						const imageData = ctx.getImageData(
							0,
							0,
							canvas.width,
							canvas.height
						);

						// Add to images collection
						addImageToCollection(
							imageData.data,
							canvas.width,
							canvas.height,
							"default_image.jpg"
						);
						resolve();
					};

					img.onerror = (error) => {
						reject(new Error(`Failed to load ${imagePath}`));
					};

					img.src = imagePath;
				});

				// If we get here, the image loaded successfully
				return;
			} catch (error) {
				console.log(`Could not load image from ${imagePath}, trying next...`);
				continue;
			}
		}

		// If all paths failed
		console.warn("Could not load any default image, proceeding without one");
	} catch (error) {
		console.warn("Error in loadDefaultImage:", error);
		// Don't throw, just continue
	}
}

// Initialize logging
console.log("Image Pointcloud Demo initialized");

// Debug function - can be called from browser console
window.debugImagePointcloud = function () {
	console.log("=== Image Pointcloud Debug Info ===");
	console.log("Total loaded images:", loadedImages.length);
	console.log(
		"Loaded images:",
		loadedImages.map(
			(img, i) => `${i}: ${img.filename} (${img.width}x${img.height})`
		)
	);
	console.log("Current image index:", params.currentImageIndex);
	console.log("Transition state:", transitionState);
	console.log("GUI folder exists:", !!imageFolder);
	console.log("Image controller exists:", !!imageController);
	console.log("Point cloud exists:", !!pointCloud);
	return {
		loadedImages: loadedImages.length,
		currentIndex: params.currentImageIndex,
		transitioning: transitionState.isTransitioning,
		progress: transitionState.progress,
	};
};

// Create a fallback pointcloud immediately
createFallbackPointcloud();

// Load default image after fallback is created
// console.log("Loading default image...");
// loadDefaultImage()
// 	.then(() => {
// 		console.log("Default image loaded successfully");
// 	})
// 	.catch(error => {
// 		console.error('Failed to load default image, using fallback pointcloud:', error);
// 	});

tick();
