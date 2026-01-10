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
    
    // Set hero section background image from data attribute
    const heroSection = document.querySelector('.hero');
    if (heroSection) {
        const heroImage = heroSection.getAttribute('data-bg-image');
        if (heroImage) {
            root.style.setProperty('--hero-bg-image', `url('${imageBasePath}/${heroImage}')`);
        }
    }
    
    // Set contact section background image from data attribute
    const contactSection = document.querySelector('.contact-section');
    if (contactSection) {
        const contactImage = contactSection.getAttribute('data-bg-image');
        if (contactImage) {
            root.style.setProperty('--contact-bg-image', `url('${imageBasePath}/${contactImage}')`);
        }
    }
    
    // Initialize modal after images are loaded (small delay to ensure src is set)
    setTimeout(() => {
        initializeModal();
    }, 100);
    
    // Set minimum date for event date input (60 days from today)
    const eventDateInput = document.getElementById('event-date');
    if (eventDateInput) {
        const today = new Date();
        const minDate = new Date(today);
        minDate.setDate(today.getDate() + 60);
        const minDateString = minDate.toISOString().split('T')[0];
        eventDateInput.setAttribute('min', minDateString);
        
        // Set default value to 90 days from today if not already set
        if (!eventDateInput.value) {
            const defaultDate = new Date(today);
            defaultDate.setDate(today.getDate() + 90);
            const defaultDateString = defaultDate.toISOString().split('T')[0];
            eventDateInput.value = defaultDateString;
        }
    }
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
        img.id !== 'modalImage' && !img.closest('#imageModal') && img.src && !img.classList.contains('no-modal')
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

// Fallback testimonials (used if JSON file can't be loaded)
const FALLBACK_TESTIMONIALS = [
    {
        "text": "Sue has done my 3 daughters wedding bouquets, full reception table and venue arrangements. I was so impressed with Sue's ability to take my girl's styles and wishes to create such beautiful designs that were to what they wanted for their special day! Everything came out so beautiful and exactly what they wanted. She goes above and beyond to provide great customer service and make sure your venue looks perfect on time for the day. She was able to provide ideas promptly based on our communications. Flowers were fresh and held up perfectly. I would recommend for any occasion.",
        "author": "linda"
    },
    {
        "text": "Sue was amazing to work with! While we didn't get a chance to meet her in person, our voice and text conversations were all she needed for her talent to run and deliver. Big and gorgeous blooms - our garden party wedding was SO chic.",
        "author": "toria"
    },
    {
        "text": "I was so impressed with Sue's ability to take my imagination and make it happen! Flowers were so beautiful and exactly what I wanted. Customer service was incredible. Communication was easy and prompt. Flowers were fresh and held up perfectly.",
        "author": "rachel"
    }
];

// Load testimonials from JSON file
async function loadTestimonials() {
    const container = document.getElementById('testimonials-container');
    const loadingEl = document.getElementById('testimonials-loading');
    const errorEl = document.getElementById('testimonials-error');
    
    if (!container) return;
    
    try {
        // Hide error, show loading
        if (errorEl) errorEl.style.display = 'none';
        if (loadingEl) loadingEl.style.display = 'block';
        
        // Fetch testimonials.json
        const response = await fetch('testimonials.json');
        if (!response.ok) {
            throw new Error(`Failed to load testimonials: ${response.status}`);
        }
        
        const data = await response.json();
        const testimonials = data.testimonials || [];
        
        if (testimonials.length === 0) {
            throw new Error('No testimonials found in testimonials.json');
        }
        
        // Hide loading, render testimonials
        if (loadingEl) loadingEl.style.display = 'none';
        renderTestimonials(testimonials);
        
    } catch (error) {
        console.error('Error loading testimonials:', error);
        console.warn('Using fallback testimonials. If you see this, make sure you\'re running from a web server (not file://) or check that testimonials.json is accessible.');
        
        // Use fallback testimonials
        if (loadingEl) loadingEl.style.display = 'none';
        if (errorEl) errorEl.style.display = 'none';
        renderTestimonials(FALLBACK_TESTIMONIALS);
    }
}

// Testimonials carousel state
let testimonialsData = [];
let currentTestimonialIndex = 0;
let testimonialInterval = null;

// Render testimonials in carousel format
function renderTestimonials(testimonials) {
    const container = document.getElementById('testimonials-container');
    if (!container) return;
    
    // Clear loading/error states
    const loadingEl = document.getElementById('testimonials-loading');
    const errorEl = document.getElementById('testimonials-error');
    const prevBtn = document.getElementById('testimonial-prev');
    const nextBtn = document.getElementById('testimonial-next');
    
    if (loadingEl) loadingEl.style.display = 'none';
    if (errorEl) errorEl.style.display = 'none';
    
    // Store testimonials data
    testimonialsData = testimonials;
    currentTestimonialIndex = 0;
    
    // Show navigation arrows if more than one testimonial (hidden by default, shown on hover via CSS)
    if (testimonials.length > 1) {
        if (prevBtn) prevBtn.style.display = 'flex';
        if (nextBtn) nextBtn.style.display = 'flex';
    } else {
        if (prevBtn) prevBtn.style.display = 'none';
        if (nextBtn) nextBtn.style.display = 'none';
    }
    
    // Clear existing testimonials (but keep navigation buttons)
    const existingItems = container.querySelectorAll('.testimonial-item');
    existingItems.forEach(item => item.remove());
    
    // Create HTML for all testimonials (hidden by default)
    const testimonialsHTML = testimonials.map((testimonial, index) => {
        const authorName = testimonial.author || 'Anonymous';
        // Title case the author name (capitalize first letter)
        const capitalizedName = authorName.charAt(0).toUpperCase() + authorName.slice(1).toLowerCase();
        const text = testimonial.text || '';
        
        // Format text - break into lines for better display, preserve existing formatting
        // Keep original case (not uppercase) for softer appearance
        const formattedText = text.replace(/\n/g, '<br>');
        
        return `
            <div class="testimonial-item ${index === 0 ? 'active' : ''}">
                <p class="testimonial-quote">${formattedText}</p>
                <p class="testimonial-author">— ${capitalizedName}</p>
            </div>
        `;
    }).join('');
    
    // Insert testimonials into container
    container.insertAdjacentHTML('beforeend', testimonialsHTML);
    
    // Start auto-rotation
    startTestimonialRotation();
}

// Show specific testimonial
function showTestimonial(index) {
    const items = document.querySelectorAll('.testimonial-item');
    if (items.length === 0) return;
    
    // Ensure index is within bounds
    if (index < 0) {
        index = testimonialsData.length - 1;
    } else if (index >= testimonialsData.length) {
        index = 0;
    }
    
    currentTestimonialIndex = index;
    
    // Update active class
    items.forEach((item, i) => {
        item.classList.toggle('active', i === index);
    });
}

// Navigate to next testimonial
function nextTestimonial() {
    showTestimonial(currentTestimonialIndex + 1);
    resetTestimonialRotation();
}

// Navigate to previous testimonial
function prevTestimonial() {
    showTestimonial(currentTestimonialIndex - 1);
    resetTestimonialRotation();
}

// Start auto-rotation (15 seconds)
function startTestimonialRotation() {
    if (testimonialsData.length <= 1) return;
    
    testimonialInterval = setInterval(() => {
        nextTestimonial();
    }, 15000); // 15 seconds
}

// Reset rotation timer
function resetTestimonialRotation() {
    if (testimonialInterval) {
        clearInterval(testimonialInterval);
    }
    startTestimonialRotation();
}

// Stop rotation (when user manually navigates)
function stopTestimonialRotation() {
    if (testimonialInterval) {
        clearInterval(testimonialInterval);
        testimonialInterval = null;
    }
}

// Swipe support for mobile testimonials
let testimonialTouchStartX = 0;
let testimonialTouchEndX = 0;

function handleTestimonialSwipe() {
    const container = document.getElementById('testimonials-container');
    if (!container) return;
    
    container.addEventListener('touchstart', (e) => {
        testimonialTouchStartX = e.changedTouches[0].screenX;
    }, { passive: true });
    
    container.addEventListener('touchend', (e) => {
        testimonialTouchEndX = e.changedTouches[0].screenX;
        const diff = testimonialTouchStartX - testimonialTouchEndX;
        const threshold = 50; // Minimum swipe distance
        
        if (Math.abs(diff) > threshold) {
            if (diff > 0) {
                // Swiped left - next
                nextTestimonial();
            } else {
                // Swiped right - previous
                prevTestimonial();
            }
        }
    }, { passive: true });
}

// Initialize testimonials on page load
document.addEventListener('DOMContentLoaded', () => {
    loadTestimonials();
    
    // Set up navigation button event listeners
    const prevBtn = document.getElementById('testimonial-prev');
    const nextBtn = document.getElementById('testimonial-next');
    
    if (prevBtn) {
        prevBtn.addEventListener('click', () => {
            prevTestimonial();
        });
    }
    
    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            nextTestimonial();
        });
    }
    
    // Pause rotation on hover
    const container = document.getElementById('testimonials-container');
    if (container) {
        container.addEventListener('mouseenter', stopTestimonialRotation);
        container.addEventListener('mouseleave', startTestimonialRotation);
    }
    
    // Add swipe support for mobile
    handleTestimonialSwipe();
});
