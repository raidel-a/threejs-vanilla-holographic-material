import * as THREE from "three";

/**
 * Base
 */
const canvas = document.querySelector("canvas.webgl");
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000033);

/**
 * Renderer
 */
const renderer = new THREE.WebGLRenderer({
	canvas: canvas,
	antialias: true,
	alpha: true,
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

/**
 * Camera
 */
const camera = new THREE.PerspectiveCamera(
	75,
	window.innerWidth / window.innerHeight,
	0.1,
	1000
);
camera.position.set(0, 0, 5);
scene.add(camera);

/**
 * Image pointcloud system
 */
class ImagePointcloud {
	constructor(imageSrc, scene, index = 0) {
		this.scene = scene;
		this.particles = null;
		this.particlesMaterial = null;
		this.index = index;
		this.loadImage(imageSrc);
	}

	loadImage(imageSrc) {
		const img = new Image();
		img.crossOrigin = "Anonymous";

		img.onload = () => {
			this.createParticlesFromImage(img);
		};

		img.onerror = () => {
			console.error("Failed to load image:", imageSrc);
		};

		img.src = imageSrc;
	}

	createParticlesFromImage(img) {
		const canvas = document.createElement("canvas");
		const ctx = canvas.getContext("2d");

		const maxSize = 250;
		const aspectRatio = img.width / img.height;

		if (aspectRatio > 1) {
			canvas.width = maxSize;
			canvas.height = maxSize / aspectRatio;
		} else {
			canvas.width = maxSize * aspectRatio;
			canvas.height = maxSize;
		}

		ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
		const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
		const data = imageData.data;

		const positions = [];
		const colors = [];

		for (let y = 0; y < canvas.height; y += 1) {
			for (let x = 0; x < canvas.width; x += 1) {
				const index = (y * canvas.width + x) * 4;
				const alpha = data[index + 3];

				if (alpha > 128) {
					const posX = (x - canvas.width / 2) * 0.02;
					const posY = -(y - canvas.height / 2) * 0.02;
					const posZ = (Math.random() - 0.5) * 0.1;

					positions.push(posX, posY, posZ);

					const r = data[index] / 255;
					const g = data[index + 1] / 255;
					const b = data[index + 2] / 255;

					colors.push(r, g, b);
				}
			}
		}

		const geometry = new THREE.BufferGeometry();
		geometry.setAttribute(
			"position",
			new THREE.Float32BufferAttribute(positions, 3)
		);
		geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));

		this.particlesMaterial = new THREE.PointsMaterial({
			size: 0.025,
			vertexColors: true,
			transparent: true,
			opacity: 0.9,
			blending: THREE.CustomBlending,
			blendEquation: THREE.AlwaysStencilFunc,
			blendSrc: THREE.SrcColorFactor,
			blendDst: THREE.OneMinusSrcAlphaFactor,
			depthWrite: false,
			depthTest: true,
		});

		this.particles = new THREE.Points(geometry, this.particlesMaterial);

		// Position pointcloud relative to center
		// const totalItems = 3; // We have 3 images
		const spacing = 5; // Distance between items

		// Position relative to center (will be adjusted dynamically)
		const x = this.index * spacing; // Initial positioning
		const y = 0;
		const z = 0;

		this.particles.position.set(x, y, z);

		// Scale down non-active items slightly
		const scale = this.index === 0 ? 1.0 : 0.6;
		this.particles.scale.set(scale, scale, scale);
		this.scene.add(this.particles);
	}

	remove() {
		if (this.particles) {
			this.scene.remove(this.particles);
			this.particles.geometry.dispose();
			this.particlesMaterial.dispose();
		}
	}
}

/**
 * Carousel system
 */
class Carousel3D {
	constructor() {
		this.items = [];
		this.currentIndex = 0;
		this.pointclouds = [];
		this.imageUrls = ["Bryan.png", "Nikohl.png", "Raidel.png"];
		this.loadingOverlay = document.getElementById("loadingOverlay");
		this.imagesLoaded = 0;

		this.isDragging = false;
		this.startX = 0;
		this.currentTranslate = 0;
		this.prevTranslate = 0;

		this.init();
	}

	init() {
		this.createCarouselItems();
		this.setupEventListeners();
		this.loadImages();
	}

	createCarouselItems() {
		const carousel = document.querySelector(".carousel");

		this.imageUrls.forEach((url, index) => {
			const item = document.createElement("div");
			item.className = "carousel-item";
			item.style.setProperty("--items", this.imageUrls.length);
			item.style.setProperty("--zIndex", index + 1);
			item.style.setProperty("--active", index === 0 ? 0 : index - 1);

			const box = document.createElement("div");
			box.className = "carousel-box";

			const title = document.createElement("div");
			title.className = "title";
			// Extract name from filename (remove .png extension)
			const fileName = url.replace(".png", "");
			title.textContent = fileName;

			const num = document.createElement("div");
			num.className = "num";
			num.textContent = `0${index + 1}`;

			box.appendChild(title);
			box.appendChild(num);
			item.appendChild(box);
			carousel.appendChild(item);

			this.items.push(item);
		});
	}

	loadImages() {
		this.imageUrls.forEach((url, index) => {
			setTimeout(() => {
				const pointcloud = new ImagePointcloud(url, scene, index);
				this.pointclouds.push(pointcloud);

				this.imagesLoaded++;
				if (this.imagesLoaded === this.imageUrls.length) {
					this.hideLoadingOverlay();
					this.updatePointcloudPositions();
				}
			}, index * 500); // Stagger loading
		});
	}

	hideLoadingOverlay() {
		setTimeout(() => {
			this.loadingOverlay.classList.add("hidden");
			this.updatePlacard(); // Show placard after loading
		}, 1000);
	}

	showCurrentPointcloud() {
		this.pointclouds.forEach((pointcloud, index) => {
			if (pointcloud.particles) {
				pointcloud.particles.visible = index === this.currentIndex;
			}
		});
	}

	updatePointcloudPositions() {
		this.pointclouds.forEach((pointcloud, index) => {
			if (pointcloud.particles) {
				const spacing = 5;

				// Calculate position relative to current active image
				// Active image is always at center (x=0)
				const offset = index - this.currentIndex;
				const x = offset * spacing; // Slide left/right based on offset
				const y = 0;
				const z = Math.abs(offset) * -0.5; // Slightly push non-active items back

				// Animate to new position with smooth transition
				const currentPos = pointcloud.particles.position;
				const targetPos = { x, y, z };

				// Smooth interpolation for sliding effect
				currentPos.x += (targetPos.x - currentPos.x) * 0.1;
				currentPos.y += (targetPos.y - currentPos.y) * 0.1;
				currentPos.z += (targetPos.z - currentPos.z) * 0.1;

				// Scale and opacity based on active state
				const isActive = index === this.currentIndex;
				const targetScale = isActive ? 1.2 : 0.7; // More dramatic scale difference
				const targetOpacity = isActive ? 1.0 : 0.3;

				// Smooth scale transition
				const currentScale = pointcloud.particles.scale.x;
				const newScale = currentScale + (targetScale - currentScale) * 0.1;
				pointcloud.particles.scale.set(newScale, newScale, newScale);

				if (pointcloud.particlesMaterial) {
					const currentOpacity = pointcloud.particlesMaterial.opacity;
					pointcloud.particlesMaterial.opacity =
						currentOpacity + (targetOpacity - currentOpacity) * 0.1;
				}

				// All items are visible
				pointcloud.particles.visible = true;
			}
		});
	}

	setupEventListeners() {
		// Mouse/touch events
		window.addEventListener("mousedown", this.handleStart.bind(this));
		window.addEventListener("mousemove", this.handleMove.bind(this));
		window.addEventListener("mouseup", this.handleEnd.bind(this));

		window.addEventListener("touchstart", this.handleStart.bind(this));
		window.addEventListener("touchmove", this.handleMove.bind(this));
		window.addEventListener("touchend", this.handleEnd.bind(this));

		// Wheel event
		window.addEventListener("wheel", this.handleWheel.bind(this));

		// Cursor tracking
		document.addEventListener("mousemove", this.updateCursor.bind(this));
	}

	handleStart(event) {
		this.isDragging = true;
		this.startX = this.getPositionX(event); // Changed from Y to X
		document.body.style.cursor = "grabbing";
	}

	handleMove(event) {
		if (!this.isDragging) return;

		const currentPosition = this.getPositionX(event); // Changed from Y to X
		this.currentTranslate =
			this.prevTranslate + (currentPosition - this.startX); // Changed from startY to startX
	}

	handleEnd() {
		this.isDragging = false;
		document.body.style.cursor = "default";

		const threshold = 50;
		// Inverted logic to match horizontal carousel movement
		if (this.currentTranslate > threshold) {
			this.prev(); // Drag right = go to previous (left)
		} else if (this.currentTranslate < -threshold) {
			this.next(); // Drag left = go to next (right)
		}

		this.currentTranslate = 0;
		this.prevTranslate = 0;
	}

	handleWheel(event) {
		event.preventDefault();
		// Inverted wheel direction to match horizontal layout
		if (event.deltaY > 0) {
			this.next(); // Scroll down = go right
		} else {
			this.prev(); // Scroll up = go left
		}
	}

	getPositionX(event) {
		return event.type.includes("mouse")
			? event.clientX
			: event.touches[0].clientX;
	}

	getPositionY(event) {
		return event.type.includes("mouse")
			? event.clientY
			: event.touches[0].clientY;
	}

	updateCursor(event) {
		const cursor = document.querySelector(".cursor");
		const cursor2 = document.querySelector(".cursor2");

		if (cursor)
			cursor.style.transform = `translate(${event.clientX}px, ${event.clientY}px)`;
		if (cursor2)
			cursor2.style.transform = `translate(${event.clientX}px, ${event.clientY}px)`;
	}

	next() {
		this.currentIndex = (this.currentIndex + 1) % this.imageUrls.length;
		this.updateCarousel();
	}

	prev() {
		this.currentIndex =
			(this.currentIndex - 1 + this.imageUrls.length) % this.imageUrls.length;
		this.updateCarousel();
	}

	updateCarousel() {
		this.items.forEach((item, index) => {
			const offset = index - this.currentIndex;
			item.style.setProperty("--active", offset);
		});

		this.updatePointcloudPositions();
		this.updatePlacard();
	}

	updatePlacard() {
		const placard = document.getElementById("imagePlacard");
		const titleElement = document.getElementById("imageTitle");
		const numberElement = document.getElementById("imageNumber");

		if (placard && titleElement && numberElement) {
			// Extract name from current image URL
			const currentImageUrl = this.imageUrls[this.currentIndex];
			const fileName = currentImageUrl.replace(".png", "");

			// Update content with actual name
			titleElement.textContent = fileName;
			numberElement.textContent = `${this.currentIndex + 1} of ${
				this.imageUrls.length
			}`;

			// Show placard if hidden
			if (!placard.classList.contains("visible")) {
				setTimeout(() => {
					placard.classList.add("visible");
				}, 500); // Delay to show after initial load
			}
		}
	}
}

/**
 * Initialize
 */
const carousel = new Carousel3D();

/**
 * Animation loop
 */
const tick = () => {
	// Update smooth positioning transitions
	carousel.updatePointcloudPositions();

	// Subtle back-and-forth rotation for current pointcloud
	const time = Date.now() * 0.001; // Convert to seconds
	carousel.pointclouds.forEach((pointcloud, index) => {
		if (pointcloud.particles && index === carousel.currentIndex) {
			// Gentle oscillating rotation
			const rotationAmplitude = 0.1; // Maximum rotation angle in radians
			const rotationSpeed = 0.5; // Speed of oscillation

			pointcloud.particles.rotation.y =
				Math.sin(time * rotationSpeed) * rotationAmplitude;
			pointcloud.particles.rotation.x =
				Math.sin(time * rotationSpeed * 0.7) * rotationAmplitude * 0.5;
		}
	});

	renderer.render(scene, camera);
	window.requestAnimationFrame(tick);
};
tick();

/**
 * Handle resize
 */
window.addEventListener("resize", () => {
	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();
	renderer.setSize(window.innerWidth, window.innerHeight);
	renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
});
