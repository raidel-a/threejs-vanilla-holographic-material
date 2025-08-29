import * as THREE from "three";

/**
 * Base
 */
const canvas = document.querySelector("canvas.webgl");
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000011);

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
	constructor(imageSrc, scene) {
		this.scene = scene;
		this.particles = null;
		this.particlesMaterial = null;
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

		const maxSize = 128;
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

		for (let y = 0; y < canvas.height; y += 2) {
			for (let x = 0; x < canvas.width; x += 2) {
				const index = (y * canvas.width + x) * 4;
				const alpha = data[index + 3];

				if (alpha > 128) {
					const posX = (x - canvas.width / 2) * 0.02;
					const posY = -(y - canvas.height / 2) * 0.02;
					const posZ = (Math.random() - 0.5) * 0.5;

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
			size: 0.05,
			vertexColors: true,
			transparent: true,
			opacity: 0.8,
			blending: THREE.AdditiveBlending,
		});

		this.particles = new THREE.Points(geometry, this.particlesMaterial);
		this.particles.position.set(0, 0, 0);
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
		this.imageUrls = [
			"/static/digital_painting_golden_hour_sunset.jpg",
			"/static/background.jpg",
			"/static/android-chrome-512x512.png",
		];
		this.loadingOverlay = document.getElementById("loadingOverlay");
		this.imagesLoaded = 0;

		this.isDragging = false;
		this.startY = 0;
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
			title.textContent = `Subject ${index + 1}`;

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
				const pointcloud = new ImagePointcloud(url, scene);
				this.pointclouds.push(pointcloud);

				this.imagesLoaded++;
				if (this.imagesLoaded === this.imageUrls.length) {
					this.hideLoadingOverlay();
					this.showCurrentPointcloud();
				}
			}, index * 500); // Stagger loading
		});
	}

	hideLoadingOverlay() {
		setTimeout(() => {
			this.loadingOverlay.classList.add("hidden");
		}, 1000);
	}

	showCurrentPointcloud() {
		this.pointclouds.forEach((pointcloud, index) => {
			if (pointcloud.particles) {
				pointcloud.particles.visible = index === this.currentIndex;
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
		this.startY = this.getPositionY(event);
		document.body.style.cursor = "grabbing";
	}

	handleMove(event) {
		if (!this.isDragging) return;

		const currentPosition = this.getPositionY(event);
		this.currentTranslate =
			this.prevTranslate + (currentPosition - this.startY);
	}

	handleEnd() {
		this.isDragging = false;
		document.body.style.cursor = "default";

		const threshold = 50;
		if (this.currentTranslate > threshold) {
			this.prev();
		} else if (this.currentTranslate < -threshold) {
			this.next();
		}

		this.currentTranslate = 0;
		this.prevTranslate = 0;
	}

	handleWheel(event) {
		event.preventDefault();
		if (event.deltaY > 0) {
			this.next();
		} else {
			this.prev();
		}
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

		this.showCurrentPointcloud();

		// Animate pointclouds
		this.pointclouds.forEach((pointcloud, index) => {
			if (pointcloud.particles) {
				const isActive = index === this.currentIndex;
				const targetOpacity = isActive ? 0.8 : 0;

				if (pointcloud.particlesMaterial) {
					pointcloud.particlesMaterial.opacity = targetOpacity;
					pointcloud.particles.visible = isActive;
				}
			}
		});
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
	// Rotate current pointcloud
	carousel.pointclouds.forEach((pointcloud, index) => {
		if (pointcloud.particles && index === carousel.currentIndex) {
			pointcloud.particles.rotation.y += 0.005;
			pointcloud.particles.rotation.x += 0.002;
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
