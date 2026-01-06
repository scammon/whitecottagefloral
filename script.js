// Image path configuration - set image sources from data-src attributes
function initializeImagePaths() {
    // Get IMAGE_BASE_PATH from global scope (defined in HTML head)
    let imageBasePath = window.IMAGE_BASE_PATH;
    
    // Fallback to const if window doesn't have it
    if (!imageBasePath && typeof IMAGE_BASE_PATH !== 'undefined') {
        imageBasePath = IMAGE_BASE_PATH;
    }
    
    // Final fallback
    if (!imageBasePath) {
        imageBasePath = 'downloaded_images';
    }
    
    // Remove trailing slash if present
    imageBasePath = imageBasePath.toString().replace(/\/$/, '');
    
    // Set all image src attributes from data-src
    const images = document.querySelectorAll('img[data-src]');
    
    images.forEach(img => {
        const filename = img.getAttribute('data-src');
        if (!filename) {
            return;
        }
        
        // Construct full path
        const fullPath = `${imageBasePath}/${filename}`;
        img.src = fullPath;
        // Remove data-src to prevent lazy loading code from overwriting it
        img.removeAttribute('data-src');
    });
    
    // Set CSS custom properties for background images
    const root = document.documentElement;
    root.style.setProperty('--bg-image-1', `url('${imageBasePath}/IMG_3385.jpg')`);
    root.style.setProperty('--bg-image-2', `url('${imageBasePath}/IMG_7463.jpg')`);
    root.style.setProperty('--bg-image-3', `url('${imageBasePath}/IMG_2532.jpg')`);
    
    // Initialize modal after images are loaded (small delay to ensure src is set)
    setTimeout(() => {
        initializeModal();
    }, 100);
}

// Wait for DOM to be ready and ensure IMAGE_BASE_PATH is set
function waitForImageBasePath() {
    if (typeof window.IMAGE_BASE_PATH === 'undefined' && typeof IMAGE_BASE_PATH === 'undefined') {
        // Wait a bit more for the inline script to execute
        setTimeout(waitForImageBasePath, 10);
        return;
    }
    initializeImagePaths();
}

// Wait for DOM to be ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', waitForImageBasePath);
} else {
    // DOM is already loaded, but wait for IMAGE_BASE_PATH
    waitForImageBasePath();
}

// Mobile Navigation Toggle
const hamburger = document.querySelector('.hamburger');
const navMenu = document.querySelector('.nav-menu');

if (hamburger && navMenu) {
    hamburger.addEventListener('click', () => {
        hamburger.classList.toggle('active');
        navMenu.classList.toggle('active');
    });

    // Close menu when clicking on a link
    document.querySelectorAll('.nav-menu a').forEach(link => {
        link.addEventListener('click', () => {
            hamburger.classList.remove('active');
            navMenu.classList.remove('active');
        });
    });
}

// Smooth scrolling for navigation links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            const offsetTop = target.offsetTop - 80; // Account for fixed navbar
            window.scrollTo({
                top: offsetTop,
                behavior: 'smooth'
            });
        }
    });
});

// Navbar background on scroll
const navbar = document.querySelector('.navbar');
let lastScroll = 0;

window.addEventListener('scroll', () => {
    const currentScroll = window.pageYOffset;
    
    if (currentScroll > 100) {
        navbar.style.boxShadow = '0 2px 20px rgba(0, 0, 0, 0.1)';
    } else {
        navbar.style.boxShadow = '0 2px 10px rgba(0, 0, 0, 0.05)';
    }
    
    lastScroll = currentScroll;
});

// Contact Form Handling
const contactForm = document.getElementById('contactForm');

if (contactForm) {
    contactForm.addEventListener('submit', function(e) {
        // Let the form submit naturally to web3forms
        // Add loading state while submitting
        const submitButton = contactForm.querySelector('.submit-button');
        if (submitButton) {
            submitButton.textContent = 'sending...';
            submitButton.disabled = true;
        }
        
        // Note: web3forms will handle the submission and show success/error
        // The form will either redirect or stay on page with a success message
    });
}

// Lazy loading images (optional enhancement)
// Note: This only runs for images that still have data-src after initialization
// Since we set all src attributes immediately, this is mainly for any dynamically added images
if ('IntersectionObserver' in window) {
    const imageObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target;
                if (img.dataset.src) {
                    // Use the full path if IMAGE_BASE_PATH is available
                    const imageBasePath = window.IMAGE_BASE_PATH || IMAGE_BASE_PATH || 'downloaded_images';
                    const filename = img.dataset.src;
                    const fullPath = `${imageBasePath}/${filename}`;
                    img.src = fullPath;
                    img.removeAttribute('data-src');
                    observer.unobserve(img);
                }
            }
        });
    });

    // Only observe images that still have data-src (shouldn't be any after initialization)
    document.querySelectorAll('img[data-src]').forEach(img => {
        imageObserver.observe(img);
    });
}

// Add fade-in animation on scroll
const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
};

const fadeObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.style.opacity = '1';
            entry.target.style.transform = 'translateY(0)';
        }
    });
}, observerOptions);

// Apply fade-in to sections
document.querySelectorAll('section').forEach(section => {
    section.style.opacity = '0';
    section.style.transform = 'translateY(20px)';
    section.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
    fadeObserver.observe(section);
});

// Image Modal/Lightbox functionality - simplified
const imageModal = document.getElementById('imageModal');
const modalImage = document.getElementById('modalImage');
const modalClose = document.querySelector('.modal-close');
const modalPrev = document.querySelector('.modal-prev');
const modalNext = document.querySelector('.modal-next');

let pageImages = [];
let currentImageIndex = 0;

// Initialize modal
function initializeModal() {
    const images = Array.from(document.querySelectorAll('img')).filter(img => 
        img.id !== 'modalImage' && !img.closest('#imageModal') && img.src
    );
    
    pageImages = images.map(img => ({
        src: img.src,
        alt: img.alt || 'Image'
    }));
    
    // Make images clickable
    images.forEach((img, index) => {
        img.style.cursor = 'pointer';
        img.addEventListener('click', () => openModal(index));
    });
}

// Open modal
function openModal(index) {
    currentImageIndex = index;
    showImage(index);
    imageModal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

// Show image - simple direct approach
function showImage(index) {
    if (pageImages.length === 0) return;
    
    // Handle wrapping
    if (index < 0) index = pageImages.length - 1;
    if (index >= pageImages.length) index = 0;
    currentImageIndex = index;
    
    const img = pageImages[index];
    if (!img || !img.src) return;
    
    // Simple: just set the src directly
    modalImage.src = img.src;
    modalImage.alt = img.alt;
}

// Navigation
function nextImage() {
    showImage(currentImageIndex + 1);
}

function prevImage() {
    showImage(currentImageIndex - 1);
}

// Close modal
function closeModal() {
    imageModal.classList.remove('active');
    document.body.style.overflow = '';
}

// Event listeners
if (modalClose) {
    modalClose.addEventListener('click', closeModal);
}

if (modalPrev) {
    modalPrev.addEventListener('click', (e) => {
        e.stopPropagation();
        prevImage();
    });
}

if (modalNext) {
    modalNext.addEventListener('click', (e) => {
        e.stopPropagation();
        nextImage();
    });
}

if (imageModal) {
    imageModal.addEventListener('click', (e) => {
        if (e.target === imageModal) {
            closeModal();
        }
    });
}

// Keyboard navigation
document.addEventListener('keydown', (e) => {
    if (!imageModal || !imageModal.classList.contains('active')) return;
    
    if (e.key === 'Escape') {
        closeModal();
    } else if (e.key === 'ArrowLeft') {
        prevImage();
    } else if (e.key === 'ArrowRight') {
        nextImage();
    }
});

// Swipe support
let touchStartX = 0;
if (modalImage) {
    modalImage.addEventListener('touchstart', (e) => {
        touchStartX = e.changedTouches[0].screenX;
    }, { passive: true });
    
    modalImage.addEventListener('touchend', (e) => {
        const touchEndX = e.changedTouches[0].screenX;
        const diff = touchStartX - touchEndX;
        const threshold = 50;
        
        if (Math.abs(diff) > threshold) {
            if (diff > 0) nextImage();
            else prevImage();
        }
    }, { passive: true });
}
