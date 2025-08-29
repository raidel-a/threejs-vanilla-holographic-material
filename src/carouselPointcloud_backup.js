import heic2any from "heic2any";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

console.log("Starting Carousel Image Pointcloud Demo...");

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
 * Parameters
 */
const params = {
	particleCount: 5000,
	particleSize: 0.015,
	spread: 1.5,
	opacity: 1.0,
	currentImageIndex: 0,
	transitionDuration: 2.0,
};

/**
 * Image data storage
 */
const loadedImages = [];
let currentPointsObject = null;

/**
 * Transition state
 */
const transitionState = {
	isTransitioning: false,
	fromIndex: -1,
	toIndex: 0,
	startTime: 0,
	maxDuration: 5.0,
};

/**
 * 3D Carousel Class
 */
class ImageCarousel3D {
	constructor() {
		this.carousel = document.querySelector('.carousel');
		this.currentIndex = 0;
		this.items = [];
		this.totalItems = 0;
		this.pointclouds = [];
		this.imageUrls = [
			'/static/digital_painting_golden_hour_sunset.jpg',
			'/static/background.jpg',
			'/static/android-chrome-512x512.png'
		];
		this.loadingOverlay = document.getElementById('loadingOverlay');
		this.imagesLoaded = 0;
		
		// Drag state
		this.isDragging = false;
		this.startY = 0;
		this.currentTranslate = 0;
		this.prevTranslate = 0;
		
		this.init();
	}

	init() {
		this.createCarouselItems();
		this.initEvents();
		this.loadImages();
	}
	
	createCarouselItems() {
		const carousel = document.querySelector('.carousel')
		
		this.imageUrls.forEach((url, index) => {
			const item = document.createElement('div')
			item.className = 'carousel-item'
			item.style.setProperty('--items', this.imageUrls.length)
			item.style.setProperty('--zIndex', index + 1)
			item.style.setProperty('--active', index === 0 ? 0 : index - 1)
			
			const box = document.createElement('div')
			box.className = 'carousel-box'
			
			const title = document.createElement('div')
			title.className = 'title'
			title.textContent = `Subject ${index + 1}`
			
			const num = document.createElement('div')
			num.className = 'num'
			num.textContent = `0${index + 1}`
			
			box.appendChild(title)
			box.appendChild(num)
			item.appendChild(box)
			carousel.appendChild(item)
			
			this.items.push(item)
		})
		this.totalItems = this.items.length
	}

	loadImages() {
		this.imageUrls.forEach((url, index) => {
			setTimeout(() => {
				const pointcloud = new ImagePointcloud(url, scene)
				this.pointclouds.push(pointcloud)
				
				this.imagesLoaded++
				if (this.imagesLoaded === this.imageUrls.length) {
					this.hideLoadingOverlay()
					this.showCurrentPointcloud()
				}
			}, index * 500) // Stagger loading
		})
	}

	hideLoadingOverlay() {
		setTimeout(() => {
			this.loadingOverlay.classList.add('hidden')
		}, 1000)
	}

	showCurrentPointcloud() {
		this.pointclouds.forEach((pointcloud, index) => {
			if (pointcloud.particles) {
				pointcloud.particles.visible = index === this.currentIndex
			}
		})
	}
		const defaultImages = [
			{ path: '/Subject 1.png', name: 'Subject 1' },
			{ path: '/Subject 2.png', name: 'Subject 2' },
			{ path: '/Subject 3.png', name: 'Subject 3' }
		];
		
		const loadingOverlay = document.getElementById('loadingOverlay');
		
		for (const imageData of defaultImages) {
			try {
				await this.loadImageFromPath(imageData.path, imageData.name);
				console.log(`Loaded default image: ${imageData.name}`);
			} catch (error) {
				console.error(`Failed to load default image ${imageData.name}:`, error);
			}
		}
		
		if (loadedImages.length > 0) {
			this.setupCarousel();
			this.updatePointcloud(0);
			setTimeout(() => {
				loadingOverlay.classList.add('hidden');
			}, 500);
		}
	}
	
	async loadImageFromPath(imagePath, imageName) {
		return new Promise((resolve, reject) => {
			const img = new Image();
			img.crossOrigin = 'anonymous';
			
			img.onload = () => {
				const canvas = document.createElement('canvas');
				const ctx = canvas.getContext('2d');
				canvas.width = img.width;
				canvas.height = img.height;
				ctx.drawImage(img, 0, 0);
				
				const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
				const positions = [];
				const colors = [];
				
				// Probabilistic sampling for better distribution
				const targetCount = params.particleCount;
				const totalPixels = canvas.width * canvas.height;
				const probability = Math.min(1.0, targetCount / totalPixels);
				
				for (let y = 0; y < canvas.height; y++) {
					for (let x = 0; x < canvas.width; x++) {
						const index = (y * canvas.width + x) * 4;
						const r = imageData.data[index] / 255;
						const g = imageData.data[index + 1] / 255;
						const b = imageData.data[index + 2] / 255;
						const a = imageData.data[index + 3] / 255;
						
						if (a > 0.1 && Math.random() < probability) {
							// Convert to 3D coordinates
							const xPos = (x / canvas.width - 0.5) * params.spread;
							const yPos = -(y / canvas.height - 0.5) * params.spread;
							const zPos = (Math.random() - 0.5) * 0.1;
							
							positions.push(xPos, yPos, zPos);
							colors.push(r, g, b);
						}
					}
				}
				
				loadedImages.push({
					filename: imageName,
					positions: new Float32Array(positions),
					colors: new Float32Array(colors),
					thumbnail: canvas.toDataURL(),
					particleCount: positions.length / 3,
					data: imageData,
					width: canvas.width,
					height: canvas.height
				});
				
				resolve();
			};
			
			img.onerror = reject;
			img.src = imagePath;
		});
	}
	
	setupCarousel() {
		this.totalItems = loadedImages.length;
		this.itemAngle = 360 / this.totalItems;
		this.items = [];
		
		// Clear existing items
		this.carousel.innerHTML = '';
		
		// Create carousel items
		loadedImages.forEach((image, index) => {
			const item = document.createElement('div');
			item.className = 'carousel-item';
			item.dataset.index = index;
			
			// Add thumbnail
			const img = document.createElement('img');
			img.src = image.thumbnail;
			img.alt = image.filename;
			item.appendChild(img);
			
			// Add text
			const text = document.createElement('div');
			text.textContent = image.filename;
			item.appendChild(text);
			
			// Position item in 3D space
			this.positionItem(item, index);
			
			// Add click handler
			item.addEventListener('click', (e) => {
				e.stopPropagation();
				this.selectItem(index);
			});
			
			this.carousel.appendChild(item);
			this.items.push(item);
		});
		
		this.updateActiveItem();
	}
	
	positionItem(item, index) {
		const angle = index * this.itemAngle;
		const radian = (angle * Math.PI) / 180;
		const x = Math.sin(radian) * this.radius;
		const z = Math.cos(radian) * this.radius;
		
		item.style.transform = `translate3d(${x}px, 0, ${z}px) rotateY(${-angle}deg)`;
	}
	
	initEvents() {
		// Pointer events for better drag support
		this.carousel.addEventListener('pointerdown', this.onPointerDown.bind(this));
		document.addEventListener('pointermove', this.onPointerMove.bind(this));
		document.addEventListener('pointerup', this.onPointerUp.bind(this));
		document.addEventListener('pointercancel', this.onPointerUp.bind(this));
		
		// Wheel event for scroll support
		this.carousel.addEventListener('wheel', this.onWheel.bind(this));
		
		// Button events
		this.prevBtn.addEventListener('click', () => this.navigate(-1));
		this.nextBtn.addEventListener('click', () => this.navigate(1));
		
		// Prevent default drag behavior
		this.carousel.addEventListener('dragstart', (e) => e.preventDefault());
		
		// Animation loop
		this.animate();
	}
	
	onPointerDown(e) {
		this.isDragging = true;
		this.previousPointerPosition = e.clientX;
		this.velocity = 0;
		this.carousel.setPointerCapture(e.pointerId);
		this.carousel.style.cursor = 'grabbing';
		e.preventDefault();
	}
	
	onPointerMove(e) {
		if (!this.isDragging) return;
		
		const deltaX = e.clientX - this.previousPointerPosition;
		this.velocity = deltaX * 0.8; // Increased sensitivity
		this.targetRotationY += this.velocity;
		this.previousPointerPosition = e.clientX;
		
		e.preventDefault();
	}
	
	onPointerUp(e) {
		if (!this.isDragging) return;
		
		this.isDragging = false;
		this.carousel.style.cursor = 'grab';
		
		// Apply momentum briefly, then snap
		setTimeout(() => this.snapToNearest(), 100);
	}
	
	onWheel(e) {
		e.preventDefault();
		const wheelSensitivity = 0.8;
		this.targetRotationY += e.deltaY * wheelSensitivity;
		this.velocity = e.deltaY * wheelSensitivity;
		
		// Debounced snap to nearest
		clearTimeout(this.wheelTimeout);
		this.wheelTimeout = setTimeout(() => this.snapToNearest(), 150);
	}
	
	snapToNearest() {
		// Calculate which item should be active based on rotation
		const normalizedRotation = ((this.targetRotationY % 360) + 360) % 360;
		const nearestIndex = Math.round(normalizedRotation / this.itemAngle) % this.totalItems;
		
		// Snap to exact position
		this.targetRotationY = nearestIndex * this.itemAngle;
		
		// Update active item if changed
		if (nearestIndex !== this.currentIndex) {
			this.currentIndex = nearestIndex;
			this.updateActiveItem();
			this.updatePointcloud(this.currentIndex);
		}
	}
	
	navigate(direction) {
		if (transitionState.isTransitioning) return;
		
		this.currentIndex = (this.currentIndex + direction + this.totalItems) % this.totalItems;
		this.targetRotationY = this.currentIndex * this.itemAngle;
		
		this.updateActiveItem();
		this.updatePointcloud(this.currentIndex);
	}
	
	selectItem(index) {
		if (index === this.currentIndex || transitionState.isTransitioning) return;
		
		this.currentIndex = index;
		this.targetRotationY = index * this.itemAngle;
		
		this.updateActiveItem();
		this.updatePointcloud(index);
	}
	
	updateActiveItem() {
		// Update visual state
		this.items.forEach((item, index) => {
			if (index === this.currentIndex) {
				item.classList.add('active');
			} else {
				item.classList.remove('active');
			}
		});
		
		// Update info display
		if (loadedImages[this.currentIndex]) {
			this.carouselInfo.textContent = loadedImages[this.currentIndex].filename;
		}
	}
	
	updatePointcloud(index) {
		if (!loadedImages[index]) return;
		
		transitionState.isTransitioning = true;
		transitionState.fromIndex = params.currentImageIndex;
		transitionState.toIndex = index;
		transitionState.startTime = Date.now();
		
		params.currentImageIndex = index;
		
		// Transition to new pointcloud
		this.transitionToImage(index);
	}
	
	transitionToImage(targetIndex) {
		const targetImage = loadedImages[targetIndex];
		if (!targetImage) return;
		
		// Remove existing points
		if (currentPointsObject) {
			scene.remove(currentPointsObject);
			if (currentPointsObject.geometry) currentPointsObject.geometry.dispose();
			if (currentPointsObject.material) currentPointsObject.material.dispose();
		}
		
		// Create new geometry
		const geometry = new THREE.BufferGeometry();
		geometry.setAttribute('position', new THREE.BufferAttribute(targetImage.positions, 3));
		geometry.setAttribute('color', new THREE.BufferAttribute(targetImage.colors, 3));
		
		// Create material
		const material = new THREE.PointsMaterial({
			size: params.particleSize,
			vertexColors: true,
			transparent: true,
			opacity: params.opacity,
			sizeAttenuation: true,
		});
		
		// Create points object
		currentPointsObject = new THREE.Points(geometry, material);
		scene.add(currentPointsObject);
		
		// Mark transition as complete
		setTimeout(() => {
			transitionState.isTransitioning = false;
		}, 500);
		
		console.log(`Transitioned to image: ${targetImage.filename} (${targetImage.particleCount} particles)`);
	}
	
	animate() {
		requestAnimationFrame(() => this.animate());
		
		// Apply friction when not dragging
		if (!this.isDragging) {
			this.velocity *= this.friction;
			if (Math.abs(this.velocity) < 0.1) {
				this.velocity = 0;
			}
		}
		
		// Smooth rotation interpolation
		const rotationDiff = this.targetRotationY - this.rotationY;
		if (Math.abs(rotationDiff) > 0.1) {
			this.rotationY += rotationDiff * 0.15; // Smooth interpolation
		} else {
			this.rotationY = this.targetRotationY;
		}
		
		// Apply rotation to carousel
		this.carousel.style.transform = `rotateY(${this.rotationY}deg)`;
		
		// Update controls
		controls.update();
		
		// Render
		renderer.render(scene, camera);
	}
}

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
 * Initialize carousel
 */
const carousel3D = new ImageCarousel3D();

/**
 * Animation loop backup (in case carousel doesn't handle it)
 */
function animate() {
	controls.update();
	renderer.render(scene, camera);
	requestAnimationFrame(animate);
}

// Start animation if carousel doesn't handle it
if (!carousel3D.animate) {
	animate();
}
