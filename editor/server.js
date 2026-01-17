import express from 'express';
import cors from 'cors';
import { BlobServiceClient, BlockBlobClient } from '@azure/storage-blob';
import { DefaultAzureCredential, ClientSecretCredential } from '@azure/identity';
import { readFileSync, writeFileSync, readFile } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { promisify } from 'util';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const execAsync = promisify(exec);

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static('public'));

// Serve static files from parent directory for preview (styles.css, script.js)
// Handle both root paths and /api paths for iframe compatibility
const serveStaticFile = (route, filePath, contentType) => {
  app.get(route, (req, res) => {
    try {
      const fullPath = join(__dirname, '..', filePath);
      const content = readFileSync(fullPath, 'utf8');
      res.type(contentType);
      res.send(content);
    } catch (error) {
      res.status(404).type(contentType).send(`/* ${filePath} not found */`);
    }
  });
};

// Serve CSS files
serveStaticFile('/styles.css', 'styles.css', 'text/css');
serveStaticFile('/api/styles.css', 'styles.css', 'text/css');

// Serve JS files
serveStaticFile('/script.js', 'script.js', 'application/javascript');
serveStaticFile('/api/script.js', 'script.js', 'application/javascript');

// Azure Storage configuration
const storageAccountName = process.env.AZURE_STORAGE_ACCOUNT || '';
const containerName = process.env.AZURE_STORAGE_CONTAINER || '';
const tenantId = process.env.AZURE_TENANT_ID || '';
const clientId = process.env.AZURE_CLIENT_ID || '';
const clientSecret = process.env.AZURE_CLIENT_SECRET || '';

// Initialize Azure Storage client with service principal
let blobServiceClient;

if (clientId && clientSecret && tenantId) {
  // Use service principal authentication
  const credential = new ClientSecretCredential(tenantId, clientId, clientSecret);
  const accountUrl = `https://${storageAccountName}.blob.core.windows.net`;
  blobServiceClient = new BlobServiceClient(accountUrl, credential);
  console.log('✓ Authenticated with service principal');
} else {
  // Fallback to DefaultAzureCredential (for local dev with Azure CLI)
  blobServiceClient = new BlobServiceClient(
    `https://${storageAccountName}.blob.core.windows.net`,
    new DefaultAzureCredential()
  );
  console.log('✓ Using DefaultAzureCredential (local dev)');
}

const containerClient = blobServiceClient.getContainerClient(containerName);
const photosContainerClient = blobServiceClient.getContainerClient('photos');

// Ensure photos container exists
(async () => {
  try {
    await photosContainerClient.createIfNotExists({
      access: 'blob' // Public read access for images
    });
    console.log('✓ Photos container ready');
  } catch (error) {
    console.error('Error ensuring photos container exists:', error);
  }
})();

// Helper function to get nested value from object using dot notation
function getValue(obj, path) {
  return path.split('.').reduce((current, prop) => current && current[prop], obj);
}

// Helper function to set nested value in object using dot notation
function setValue(obj, path, value) {
  const keys = path.split('.');
  const lastKey = keys.pop();
  const target = keys.reduce((current, key) => {
    if (!current[key]) current[key] = {};
    return current[key];
  }, obj);
  target[lastKey] = value;
}

// Build HTML from template and data (same logic as build.js)
function buildHTML(template, data) {
  let html = template;

  // Replace simple placeholders like {{site.title}}
  html = html.replace(/\{\{([^#\/].*?)\}\}/g, (match, key) => {
    const value = getValue(data, key.trim());
    return value !== undefined ? value : match;
  });

  // Handle Handlebars-style loops {{#each array}}...{{/each}}
  const eachRegex = /\{\{#each\s+([^}]+)\}\}([\s\S]*?)\{\{\/each\}\}/g;
  let match;
  while ((match = eachRegex.exec(html)) !== null) {
    const arrayPath = match[1].trim();
    const blockTemplate = match[2];
    const array = getValue(data, arrayPath);
    
    if (Array.isArray(array)) {
      const rendered = array.map(item => {
        let itemBlock = blockTemplate;
        // Replace {{this.property}} with item.property
        itemBlock = itemBlock.replace(/\{\{this\.([^}]+)\}\}/g, (m, prop) => {
          return item[prop.trim()] || '';
        });
        // Replace {{this}} with the item itself (for strings)
        itemBlock = itemBlock.replace(/\{\{this\}\}/g, () => {
          return typeof item === 'string' ? item : '';
        });
        return itemBlock;
      }).join('');
      html = html.replace(match[0], rendered);
    }
  }

  // Replace sections with custom HTML if available
  // Map of section identifiers to data paths
  const sectionMap = [
    { id: 'home', class: 'hero', path: 'hero' },
    { class: 'experience-section', path: 'experience' },
    { class: 'testimonial-section', path: 'testimonial' },
    { id: 'about', class: 'about-section', path: 'about' },
    { id: 'services', class: 'services-section', path: 'services' },
    { id: 'portfolio', class: 'portfolio-section', path: 'portfolio' },
    { class: 'standards-section', path: 'standards' },
    { class: 'location-section', path: 'location' },
    { id: 'contact', class: 'contact-section', path: 'contact' }
  ];

  // For each section, check if customHtml exists and replace the inner content
  sectionMap.forEach(section => {
    const customHtml = getValue(data, section.path + '.customHtml');
    
    if (customHtml) {
      // Build regex to match the section opening tag
      let pattern = '<section[^>]*';
      if (section.id) {
        pattern += `id="${section.id}"[^>]*`;
      }
      if (section.class) {
        pattern += `class="[^"]*${section.class}[^"]*"[^>]*`;
      }
      pattern += '>([\\s\\S]*?)</section>';
      
      const sectionRegex = new RegExp(pattern, 'i');
      const sectionMatch = html.match(sectionRegex);
      
      if (sectionMatch) {
        // Replace the inner content with custom HTML, keeping the opening and closing tags
        html = html.replace(sectionRegex, (match, innerContent) => {
          return match.replace(innerContent, customHtml);
        });
        console.log(`Using custom HTML for ${section.path} section`);
      }
    }
  });

  return html;
}

// API: Get original data.json (production version)
app.get('/api/data/original', async (req, res) => {
  try {
    const productionPath = join(__dirname, '..', 'data.json');
    let data;
    
    try {
      // Try local data.json first
      const dataString = readFileSync(productionPath, 'utf8');
      data = JSON.parse(dataString);
      console.log('Loaded original data.json');
    } catch (localError) {
      // Fallback to Azure Storage
      console.log('Local data.json not found, fetching from Azure Storage...');
      const blobClient = containerClient.getBlobClient('data.json');
      const downloadResponse = await blobClient.download();
      const dataString = await streamToString(downloadResponse.readableStreamBody);
      data = JSON.parse(dataString);
      console.log('Loaded original data.json from Azure Storage');
    }
    
    res.json(data);
  } catch (error) {
    console.error('Error fetching original data:', error);
    res.status(500).json({ error: 'Failed to fetch original data', details: error.message });
  }
});

// API: Get data-preview.json (or create from data.json if it doesn't exist)
app.get('/api/data', async (req, res) => {
  try {
    const previewPath = join(__dirname, '..', 'data-preview.json');
    const productionPath = join(__dirname, '..', 'data.json');
    
    // Try to read data-preview.json first
    let data;
    try {
      const dataString = readFileSync(previewPath, 'utf8');
      data = JSON.parse(dataString);
      console.log('Loaded data-preview.json');
    } catch (previewError) {
      // If data-preview.json doesn't exist, try to create it from data.json
      console.log('data-preview.json not found, creating from data.json...');
      try {
        // Try local data.json first
        const dataString = readFileSync(productionPath, 'utf8');
        data = JSON.parse(dataString);
        // Create data-preview.json from data.json
        writeFileSync(previewPath, dataString, 'utf8');
        console.log('Created data-preview.json from local data.json');
      } catch (localError) {
        // Fallback to Azure Storage
        console.log('Local data.json not found, fetching from Azure Storage...');
        const blobClient = containerClient.getBlobClient('data.json');
        const downloadResponse = await blobClient.download();
        const dataString = await streamToString(downloadResponse.readableStreamBody);
        data = JSON.parse(dataString);
        // Create data-preview.json from Azure data.json
        writeFileSync(previewPath, dataString, 'utf8');
        console.log('Created data-preview.json from Azure data.json');
      }
    }
    
    res.json(data);
  } catch (error) {
    console.error('Error fetching data:', error);
    res.status(500).json({ error: 'Failed to fetch data', details: error.message });
  }
});

// API: Update data-preview.json (not uploaded to Azure until publish)
app.put('/api/data', async (req, res) => {
  try {
    const data = req.body;
    const dataString = JSON.stringify(data, null, 2);
    const previewPath = join(__dirname, '..', 'data-preview.json');
    
    // Save to data-preview.json only - data.json stays as production version
    writeFileSync(previewPath, dataString, 'utf8');
    
    res.json({ success: true, message: 'Data saved to data-preview.json' });
  } catch (error) {
    console.error('Error saving data-preview.json:', error);
    res.status(500).json({ error: 'Failed to save data-preview.json', details: error.message });
  }
});

// API: Reset data-preview.json to match production data.json
app.post('/api/data/reset', async (req, res) => {
  try {
    const previewPath = join(__dirname, '..', 'data-preview.json');
    const productionPath = join(__dirname, '..', 'data.json');
    let dataString;
    
    try {
      // Try local data.json first
      dataString = readFileSync(productionPath, 'utf8');
      console.log('Reset: Using local data.json');
    } catch (localError) {
      // Fallback to Azure Storage
      console.log('Reset: Local data.json not found, fetching from Azure Storage...');
      const blobClient = containerClient.getBlobClient('data.json');
      const downloadResponse = await blobClient.download();
      dataString = await streamToString(downloadResponse.readableStreamBody);
      console.log('Reset: Using Azure Storage data.json');
    }
    
    // Write to data-preview.json (overwrites any existing preview data)
    writeFileSync(previewPath, dataString, 'utf8');
    console.log('Reset: data-preview.json reset to match production');
    
    res.json({ success: true, message: 'Preview reset to match production' });
  } catch (error) {
    console.error('Error resetting preview:', error);
    res.status(500).json({ error: 'Failed to reset preview', details: error.message });
  }
});

// API: Get Google Reviews (proxy endpoint to hide API key)
// Requires GOOGLE_PLACES_API_KEY and GOOGLE_PLACE_ID in .env file
app.get('/api/google-reviews', async (req, res) => {
  try {
    const apiKey = process.env.GOOGLE_PLACES_API_KEY;
    const placeId = process.env.GOOGLE_PLACE_ID;
    
    if (!apiKey || !placeId) {
      return res.status(500).json({ 
        error: 'Google Places API not configured', 
        details: 'Please set GOOGLE_PLACES_API_KEY and GOOGLE_PLACE_ID in .env file' 
      });
    }
    
    // Fetch reviews from Google Places API
    const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=reviews&key=${apiKey}`;
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Google Places API returned ${response.status}`);
    }
    
    const data = await response.json();
    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      throw new Error(`Google Places API error: ${data.status} - ${data.error_message || 'Unknown error'}`);
    }
    
    // Return reviews (filtered to 5-star on client side)
    res.json({ 
      reviews: data.result?.reviews || [],
      status: data.status 
    });
  } catch (error) {
    console.error('Error fetching Google Reviews:', error);
    res.status(500).json({ 
      error: 'Failed to fetch Google Reviews', 
      details: error.message 
    });
  }
});

// API: Get preview HTML
app.get('/api/preview', async (req, res) => {
  try {
    // Read data-preview.json (from editor changes)
    const previewPath = join(__dirname, '..', 'data-preview.json');
    const productionPath = join(__dirname, '..', 'data.json');
    let data;
    
    try {
      const dataString = readFileSync(previewPath, 'utf8');
      data = JSON.parse(dataString);
      console.log('Using data-preview.json for preview');
    } catch (previewError) {
      // Fallback to data.json if data-preview.json doesn't exist
      console.log('data-preview.json not found, trying data.json...');
      try {
        const dataString = readFileSync(productionPath, 'utf8');
        data = JSON.parse(dataString);
        // Create data-preview.json from data.json
        writeFileSync(previewPath, dataString, 'utf8');
        console.log('Created data-preview.json from data.json');
      } catch (localError) {
        // Fallback to Azure Storage
        console.log('Local data.json not found, fetching from Azure Storage...');
        const blobClient = containerClient.getBlobClient('data.json');
        const downloadResponse = await blobClient.download();
        const dataString = await streamToString(downloadResponse.readableStreamBody);
        data = JSON.parse(dataString);
        // Create data-preview.json from Azure data.json
        writeFileSync(previewPath, dataString, 'utf8');
        console.log('Created data-preview.json from Azure data.json');
      }
    }

    // Read template from parent directory
    const templatePath = join(__dirname, '..', 'index.template.html');
    const template = readFileSync(templatePath, 'utf8');

    // Build HTML
    let html = buildHTML(template, data);
    
    // Get hash from URL if present and scroll to it on load
    const hash = req.url.split('#')[1];
    if (hash) {
      const scrollScript = `
        <script>
          (function() {
            // Scroll to hash on page load
            window.addEventListener('load', () => {
              const hash = '${hash}';
              const section = document.getElementById(hash) || document.querySelector('.' + hash + '-section');
              if (section) {
                // Scroll immediately without animation
                section.scrollIntoView({ behavior: 'auto', block: 'start' });
              }
            });
            
            // Also try immediately if DOM is already loaded
            if (document.readyState === 'complete') {
              const hash = '${hash}';
              const section = document.getElementById(hash) || document.querySelector('.' + hash + '-section');
              if (section) {
                section.scrollIntoView({ behavior: 'auto', block: 'start' });
              }
            }
          })();
        </script>
      `;
      html = html.replace('</head>', scrollScript + '</head>');
    }
    
    // Always inject edit mode script (it will only activate when message is sent)
    const editScript = `
        <script>
          (function() {
            // Only run in iframe
            try {
              if (window.parent === window) return;
            } catch(e) {
              return; // Cross-origin, can't access parent
            }
            
            console.log('Edit mode script loaded');
            
            // Element to data path mapping
            const elementMapping = {
              '.logo': 'site.logo',
              '.hero-title': 'hero.title',
              '.hero-subtitle': 'hero.subtitle',
              '.hero-tagline': 'hero.tagline',
              '.hero-specialty': 'hero.specialty',
              '.hero-locations': 'hero.locations',
              '.section-title': (el) => {
                const section = el.closest('section');
                if (section && section.id === 'about') return 'about.heading';
                if (section && section.id === 'services') return 'services.heading';
                if (section && section.classList.contains('experience-section')) return 'experience.title';
                if (section && section.classList.contains('standards-section')) return 'standards.title';
                if (section && section.classList.contains('portfolio-section')) return 'portfolio.title';
                if (section && section.classList.contains('contact-section')) return 'contact.title';
                return null;
              },
              '.experience-text': 'experience.text',
              '.testimonial-quote': 'testimonial.quote',
              '.testimonial-author': 'testimonial.author',
              '.about-text p': (el, index) => {
                const texts = el.parentElement ? el.parentElement.querySelectorAll('.about-text p') : [];
                const idx = Array.from(texts).indexOf(el);
                if (idx === 0) return 'about.intro';
                if (idx === 1) return 'about.text';
                return null;
              },
              '.service-item h4': (el, index) => {
                const items = el.closest('.services-grid') ? el.closest('.services-grid').querySelectorAll('.service-item') : [];
                const idx = Array.from(items).indexOf(el.closest('.service-item'));
                return \`services.items[\${idx}].title\`;
              },
              '.service-item p': (el, index) => {
                const items = el.closest('.services-grid') ? el.closest('.services-grid').querySelectorAll('.service-item') : [];
                const idx = Array.from(items).indexOf(el.closest('.service-item'));
                return \`services.items[\${idx}].description\`;
              },
              '.standards-list li': (el) => {
                const list = el.parentElement;
                const idx = Array.from(list.children).indexOf(el);
                return \`standards.items[\${idx}]\`;
              },
              '.location-text h3': (el, index) => {
                const texts = el.parentElement ? el.parentElement.querySelectorAll('.location-text h3') : [];
                const idx = Array.from(texts).indexOf(el);
                if (idx === 0) return 'location.heading1';
                if (idx === 1) return 'location.heading2';
                return null;
              },
              '.location-list p': 'location.places',
              '.contact-label': 'contact.label',
              '.contact-info p': 'contact.description'
            };
            
            // Image mapping for drag and drop
            const imageMapping = {
              '.hero-image img': 'hero.image.src',
              '.about-image img': 'about.image.src',
              '.portfolio-item img': (el) => {
                const portfolioItem = el.closest('.portfolio-item');
                if (!portfolioItem) return null;
                
                const items = el.closest('.portfolio-grid') ? el.closest('.portfolio-grid').querySelectorAll('.portfolio-item') : [];
                const idx = Array.from(items).indexOf(portfolioItem);
                
                // Get the image src - prefer data-src (original filename) over src (which may have full URL)
                const imgSrc = el.getAttribute('data-src') || el.getAttribute('src') || '';
                // Extract filename from src (handle both full URLs and just filenames)
                let filename = imgSrc;
                if (imgSrc.includes('/')) {
                  filename = imgSrc.split('/').pop();
                }
                filename = filename.split('?')[0]; // Remove query params
                
                return {
                  path: \`portfolio.images[\${idx}].src\`,
                  index: idx,
                  filename: filename
                };
              }
            };
            
            let editMode = false;
            
            // Listen for edit mode toggle
            window.addEventListener('message', (e) => {
              if (e.data.type === 'toggleEditMode') {
                editMode = e.data.enabled;
                if (editMode) {
                  enableEditMode();
                } else {
                  disableEditMode();
                }
                
                // Update all delete button visibilities
                const deleteButtons = document.querySelectorAll('.image-delete-btn');
                deleteButtons.forEach(btn => {
                  if (btn._updateVisibility) {
                    btn._updateVisibility();
                  }
                });
              }
            });
            
            function enableEditMode() {
              console.log('Enabling edit mode');
              
              const style = document.createElement('style');
              style.id = 'editor-styles';
              style.textContent = \`
                .editable {
                  cursor: pointer !important;
                  position: relative;
                  transition: background 0.2s;
                }
                .editable:hover {
                  background: rgba(52, 152, 219, 0.1) !important;
                  outline: 2px dashed #3498db !important;
                  outline-offset: 2px;
                }
                .editable.editing {
                  background: rgba(52, 152, 219, 0.2) !important;
                  outline: 2px solid #3498db !important;
                }
                .editable-image {
                  cursor: pointer !important;
                }
                .editable-image:hover {
                  opacity: 0.8 !important;
                }
                .portfolio-item, .hero-image, .about-image {
                  position: relative !important;
                }
                .image-delete-btn {
                  transition: opacity 0.2s, transform 0.2s;
                }
                .image-delete-btn:hover {
                  background: #c0392b !important;
                  transform: scale(1.1);
                }
              \`;
              if (!document.getElementById('editor-styles')) {
                document.head.appendChild(style);
              }
              
              // Wait for DOM to be ready
              if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', () => setupEditables());
              } else {
                setupEditables();
              }
              
              function setupEditables() {
                let editableCount = 0;
                Object.keys(elementMapping).forEach(selector => {
                  try {
                    const elements = document.querySelectorAll(selector);
                    console.log(\`Found \${elements.length} elements for selector: \${selector}\`);
                    elements.forEach((el, index) => {
                      const path = typeof elementMapping[selector] === 'function' 
                        ? elementMapping[selector](el, index)
                        : elementMapping[selector];
                      
                      if (path) {
                        el.classList.add('editable');
                        el.setAttribute('data-edit-path', path);
                        // Store both text and HTML content
                        const textContent = el.textContent.trim();
                        const htmlContent = el.innerHTML.trim();
                        el.setAttribute('data-original-content', textContent);
                        el.setAttribute('data-original-html', htmlContent);
                        
                        // Remove existing listener if any
                        const newEl = el.cloneNode(true);
                        el.parentNode.replaceChild(newEl, el);
                        
                        newEl.addEventListener('click', (e) => {
                          if (editMode) {
                            e.stopPropagation();
                            e.preventDefault();
                            editElement(newEl, path);
                          }
                        }, true);
                        
                        editableCount++;
                      }
                    });
                  } catch(err) {
                    console.error('Error setting up editables for', selector, err);
                  }
                });
                
                // Setup image drag and drop
                Object.keys(imageMapping).forEach(selector => {
                  try {
                    const elements = document.querySelectorAll(selector);
                    elements.forEach((el, index) => {
                      const mapping = typeof imageMapping[selector] === 'function' 
                        ? imageMapping[selector](el, index)
                        : { path: imageMapping[selector], index: null };
                      
                      if (mapping && mapping.path) {
                        el.classList.add('editable-image');
                        el.setAttribute('data-image-path', mapping.path);
                        if (mapping.index !== null) {
                          el.setAttribute('data-image-index', mapping.index);
                        }
                        
                        // Setup drag and drop
                        setupImageDragDrop(el, mapping);
                      }
                    });
                  } catch(err) {
                    console.error('Error setting up images for', selector, err);
                  }
                });
                
                // Setup portfolio grid for adding new images
                const portfolioGrid = document.querySelector('.portfolio-grid');
                if (portfolioGrid) {
                  setupPortfolioGridDrop(portfolioGrid);
                }
                
                // Add "Edit HTML" buttons to each section
                addEditHtmlButtons();
                
                console.log(\`Made \${editableCount} elements editable\`);
              }
              
              function addEditHtmlButtons() {
                // Map of section selectors to data paths
                const sectionMap = {
                  'section#home.hero': 'hero',
                  'section.experience-section': 'experience',
                  'section.testimonial-section': 'testimonial',
                  'section#about.about-section': 'about',
                  'section#services.services-section': 'services',
                  'section#portfolio.portfolio-section': 'portfolio',
                  'section.standards-section': 'standards',
                  'section.location-section': 'location',
                  'section#contact.contact-section': 'contact'
                };
                
                Object.keys(sectionMap).forEach(selector => {
                  try {
                    const section = document.querySelector(selector);
                    if (section) {
                      // Check if button already exists
                      let btn = section.querySelector('.edit-html-btn');
                      if (!btn) {
                        btn = document.createElement('button');
                        btn.className = 'edit-html-btn';
                        btn.innerHTML = '✏️ Edit HTML';
                        btn.style.cssText = 'position: absolute; top: 10px; right: 10px; background: #9b59b6; color: white; border: none; border-radius: 4px; padding: 8px 12px; cursor: pointer; font-size: 12px; z-index: 1000; display: none; box-shadow: 0 2px 4px rgba(0,0,0,0.2); font-weight: 600;';
                        btn.setAttribute('data-section-path', sectionMap[selector]);
                        
                        // Make section position relative if not already
                        if (getComputedStyle(section).position === 'static') {
                          section.style.position = 'relative';
                        }
                        
                        section.appendChild(btn);
                        
                        btn.onclick = (e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          editSectionHtml(section, sectionMap[selector]);
                        };
                        
                        // Show/hide based on edit mode
                        const updateVisibility = () => {
                          btn.style.display = editMode ? 'block' : 'none';
                        };
                        updateVisibility();
                        btn._updateVisibility = updateVisibility;
                      }
                    }
                  } catch(err) {
                    console.error('Error adding edit HTML button to', selector, err);
                  }
                });
              }
              
              function editSectionHtml(sectionElement, sectionPath) {
                // Extract HTML of the section (excluding the edit button)
                const clone = sectionElement.cloneNode(true);
                const editBtn = clone.querySelector('.edit-html-btn');
                if (editBtn) {
                  editBtn.remove();
                }
                const html = clone.innerHTML.trim();
                
                // Send to parent window
                try {
                  window.parent.postMessage({
                    type: 'editSectionHtml',
                    sectionPath: sectionPath,
                    html: html
                  }, '*');
                } catch(err) {
                  console.error('Error sending HTML to parent:', err);
                }
              }
              
              function setupImageDragDrop(imgElement, mapping) {
                // Add drop zone overlay
                const dropZone = document.createElement('div');
                dropZone.className = 'image-drop-zone';
                dropZone.style.cssText = 'position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: rgba(52, 152, 219, 0.1); border: 2px dashed #3498db; display: none; align-items: center; justify-content: center; z-index: 100; pointer-events: none;';
                dropZone.innerHTML = '<div style="color: #3498db; font-weight: 600;">Drop image here</div>';
                
                const container = imgElement.parentElement;
                if (container && container.style.position !== 'relative') {
                  container.style.position = 'relative';
                }
                container.appendChild(dropZone);
                
                // Make image container droppable
                ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
                  container.addEventListener(eventName, (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  });
                });
                
                ['dragenter', 'dragover'].forEach(eventName => {
                  container.addEventListener(eventName, () => {
                    if (editMode) {
                      dropZone.style.display = 'flex';
                      container.style.opacity = '0.7';
                    }
                  });
                });
                
                ['dragleave', 'drop'].forEach(eventName => {
                  container.addEventListener(eventName, () => {
                    dropZone.style.display = 'none';
                    container.style.opacity = '1';
                  });
                });
                
                container.addEventListener('drop', (e) => {
                  if (!editMode) return;
                  
                  const files = e.dataTransfer.files;
                  if (files.length > 0 && files[0].type.startsWith('image/')) {
                    handleImageUpload(files[0], mapping);
                  }
                });
                
                // Add delete button for portfolio images
                if (mapping.index !== null) {
                  // Check if delete button already exists
                  let deleteBtn = container.querySelector('.image-delete-btn');
                  if (!deleteBtn) {
                    deleteBtn = document.createElement('button');
                    deleteBtn.className = 'image-delete-btn';
                    deleteBtn.innerHTML = '×';
                    deleteBtn.style.cssText = 'position: absolute; top: 5px; right: 5px; background: #e74c3c; color: white; border: none; border-radius: 50%; width: 28px; height: 28px; cursor: pointer; font-size: 20px; line-height: 1; display: none; z-index: 101; box-shadow: 0 2px 4px rgba(0,0,0,0.2);';
                    container.appendChild(deleteBtn);
                  }
                  
                  // Update onclick handler - use filename to find correct index
                  deleteBtn.onclick = (e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    console.log('Delete button clicked for index:', mapping.index, 'filename:', mapping.filename);
                    if (confirm('Delete this image from portfolio?')) {
                      // Send both index and filename for safety
                      deletePortfolioImage(mapping.index, mapping.filename);
                    }
                  };
                  
                  // Show/hide delete button based on edit mode
                  const updateDeleteButtonVisibility = () => {
                    if (editMode) {
                      deleteBtn.style.display = 'block';
                    } else {
                      deleteBtn.style.display = 'none';
                    }
                  };
                  
                  // Show delete button on hover in edit mode
                  container.addEventListener('mouseenter', () => {
                    if (editMode) {
                      deleteBtn.style.display = 'block';
                    }
                  });
                  
                  container.addEventListener('mouseleave', () => {
                    // Keep visible in edit mode, only hide if not in edit mode
                    if (!editMode) {
                      deleteBtn.style.display = 'none';
                    }
                  });
                  
                  // Show immediately if edit mode is on
                  updateDeleteButtonVisibility();
                  
                  // Store reference to update function for when edit mode toggles
                  deleteBtn._updateVisibility = updateDeleteButtonVisibility;
                  deleteBtn._mappingIndex = mapping.index;
                }
              }
              
              function handleImageUpload(file, mapping) {
                const reader = new FileReader();
                reader.onload = (e) => {
                  const base64 = e.target.result;
                  
                  // Generate filename
                  const timestamp = Date.now();
                  const ext = file.name.split('.').pop();
                  const filename = \`portfolio_\${timestamp}.\${ext}\`;
                  
                  // Send to parent for upload
                  window.parent.postMessage({
                    type: 'imageUpload',
                    file: base64,
                    filename: filename,
                    path: mapping.path
                  }, '*');
                };
                reader.readAsDataURL(file);
              }
              
              function deletePortfolioImage(index, filename) {
                console.log('Sending delete message for index:', index, 'filename:', filename);
                try {
                  window.parent.postMessage({
                    type: 'deletePortfolioImage',
                    index: index,
                    filename: filename
                  }, '*');
                  console.log('Delete message sent');
                } catch(err) {
                  console.error('Error sending delete message:', err);
                }
              }
              
              function setupPortfolioGridDrop(grid) {
                // Make the entire grid a drop zone
                grid.style.position = 'relative';
                
                // Add visual drop zone overlay
                const dropOverlay = document.createElement('div');
                dropOverlay.className = 'portfolio-drop-overlay';
                dropOverlay.style.cssText = 'position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: rgba(52, 152, 219, 0.1); border: 3px dashed #3498db; border-radius: 8px; display: none; align-items: center; justify-content: center; z-index: 50; pointer-events: none;';
                dropOverlay.innerHTML = '<div style="color: #3498db; font-weight: 600; font-size: 18px; text-align: center; padding: 40px; background: white; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);">📷 Drop image here to add to portfolio</div>';
                
                // Insert overlay as first child so it's behind items but visible
                if (grid.firstChild) {
                  grid.insertBefore(dropOverlay, grid.firstChild);
                } else {
                  grid.appendChild(dropOverlay);
                }
                
                // Make grid droppable
                ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
                  grid.addEventListener(eventName, (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }, false);
                });
                
                let dragCounter = 0;
                
                grid.addEventListener('dragenter', (e) => {
                  if (!editMode) return;
                  dragCounter++;
                  if (dragCounter === 1) {
                    dropOverlay.style.display = 'flex';
                    grid.style.opacity = '0.7';
                  }
                });
                
                grid.addEventListener('dragover', (e) => {
                  if (!editMode) return;
                  e.preventDefault();
                });
                
                grid.addEventListener('dragleave', (e) => {
                  if (!editMode) return;
                  dragCounter--;
                  if (dragCounter === 0) {
                    dropOverlay.style.display = 'none';
                    grid.style.opacity = '1';
                  }
                });
                
                grid.addEventListener('drop', (e) => {
                  if (!editMode) return;
                  
                  dragCounter = 0;
                  dropOverlay.style.display = 'none';
                  grid.style.opacity = '1';
                  
                  const files = e.dataTransfer.files;
                  if (files.length > 0 && files[0].type.startsWith('image/')) {
                    // Add new portfolio image
                    const reader = new FileReader();
                    reader.onload = (event) => {
                      const base64 = event.target.result;
                      const timestamp = Date.now();
                      const ext = files[0].name.split('.').pop();
                      const filename = 'portfolio_' + timestamp + '.' + ext;
                      
                      window.parent.postMessage({
                        type: 'addPortfolioImage',
                        file: base64,
                        filename: filename
                      }, '*');
                    };
                    reader.readAsDataURL(files[0]);
                  }
                });
              }
            }
            
            function disableEditMode() {
              const editables = document.querySelectorAll('.editable');
              editables.forEach(el => {
                el.classList.remove('editable', 'editing');
              });
              
              // Hide all delete buttons
              const deleteButtons = document.querySelectorAll('.image-delete-btn');
              deleteButtons.forEach(btn => {
                btn.style.display = 'none';
                if (btn._updateVisibility) {
                  btn._updateVisibility();
                }
              });
            }
            
            function editElement(element, path) {
              console.log('Editing element:', path);
              const oldText = element.getAttribute('data-original-content') || element.textContent.trim();
              const oldHtml = element.getAttribute('data-original-html') || element.innerHTML.trim();
              
              // Check if original had HTML breaks - convert <br> to newlines for editing
              const hasHtmlBreaks = oldHtml.includes('<br>') || oldHtml.includes('<br/>') || oldHtml.includes('<br />');
              let displayValue = oldText;
              if (hasHtmlBreaks) {
                // Convert <br> tags to newlines for textarea
                displayValue = oldHtml.replace(/<br\\s*\\/?>/gi, '\\n');
              }
              
              // Create modal dialog with textarea
              const modal = document.createElement('div');
              modal.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 10000; display: flex; align-items: center; justify-content: center;';
              
              const dialog = document.createElement('div');
              dialog.style.cssText = 'background: white; padding: 20px; border-radius: 8px; max-width: 600px; width: 90%; max-height: 80vh; display: flex; flex-direction: column; box-shadow: 0 4px 20px rgba(0,0,0,0.3);';
              
              const label = document.createElement('label');
              label.textContent = 'Edit "' + path + '":';
              label.style.cssText = 'font-weight: 600; margin-bottom: 10px; color: #333;';
              
              const textarea = document.createElement('textarea');
              textarea.value = displayValue;
              textarea.style.cssText = 'width: 100%; min-height: 150px; padding: 10px; border: 1px solid #ddd; border-radius: 4px; font-family: inherit; font-size: 14px; resize: vertical; flex: 1;';
              textarea.rows = 8;
              
              const buttonContainer = document.createElement('div');
              buttonContainer.style.cssText = 'display: flex; gap: 10px; margin-top: 15px; justify-content: flex-end;';
              
              const cancelBtn = document.createElement('button');
              cancelBtn.textContent = 'Cancel';
              cancelBtn.style.cssText = 'padding: 8px 16px; background: #95a5a6; color: white; border: none; border-radius: 4px; cursor: pointer;';
              
              const saveBtn = document.createElement('button');
              saveBtn.textContent = 'Save';
              saveBtn.style.cssText = 'padding: 8px 16px; background: #27ae60; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: 600;';
              
              dialog.appendChild(label);
              dialog.appendChild(textarea);
              buttonContainer.appendChild(cancelBtn);
              buttonContainer.appendChild(saveBtn);
              dialog.appendChild(buttonContainer);
              modal.appendChild(dialog);
              
              document.body.appendChild(modal);
              
              // Focus textarea and select all
              setTimeout(() => {
                textarea.focus();
                textarea.select();
              }, 100);
              
              // Handle save
              const save = () => {
                const newValue = textarea.value;
                if (newValue !== oldText && newValue !== displayValue) {
                  // Convert newlines to <br> if original had HTML breaks
                  let finalValue = newValue;
                  if (hasHtmlBreaks) {
                    // Convert newlines to <br> tags
                    finalValue = newValue.replace(/\\n/g, '<br>');
                  }
                  
                  // Update element
                  element.innerHTML = finalValue;
                  element.setAttribute('data-original-content', newValue);
                  element.setAttribute('data-original-html', finalValue);
                  
                  try {
                    window.parent.postMessage({
                      type: 'elementEdited',
                      path: path,
                      newValue: finalValue,
                      oldValue: oldText
                    }, '*');
                    console.log('Sent edit message to parent');
                  } catch(err) {
                    console.error('Error sending message:', err);
                  }
                }
                document.body.removeChild(modal);
              };
              
              // Handle cancel
              const cancel = () => {
                document.body.removeChild(modal);
              };
              
              saveBtn.addEventListener('click', save);
              cancelBtn.addEventListener('click', cancel);
              
              // Close on Escape key
              const handleKeyDown = (e) => {
                if (e.key === 'Escape') {
                  cancel();
                  document.removeEventListener('keydown', handleKeyDown);
                } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault();
                  save();
                  document.removeEventListener('keydown', handleKeyDown);
                }
              };
              document.addEventListener('keydown', handleKeyDown);
              
              // Close on background click
              modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                  cancel();
                }
              });
            }
          })();
        </script>
      `;
    html = html.replace('</body>', editScript + '</body>');

    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (error) {
    console.error('Error generating preview:', error);
    res.status(500).json({ error: 'Failed to generate preview', details: error.message });
  }
});

// API: Publish (build and upload)
app.post('/api/publish', async (req, res) => {
  try {
    // Step 1: Copy data-preview.json to data.json (production version)
    const previewPath = join(__dirname, '..', 'data-preview.json');
    const productionPath = join(__dirname, '..', 'data.json');
    
    let dataString;
    try {
      // Read data-preview.json
      dataString = readFileSync(previewPath, 'utf8');
      // Copy to data.json (production version)
      writeFileSync(productionPath, dataString, 'utf8');
      console.log('✓ Copied data-preview.json to data.json (production)');
    } catch (error) {
      console.error('Error copying data-preview.json to data.json:', error);
      throw new Error(`Failed to copy preview data to production: ${error.message}`);
    }
    
    // Step 2: Upload data.json to Azure Storage
    try {
      const blockBlobClient = containerClient.getBlockBlobClient('data.json');
      const buffer = Buffer.from(dataString, 'utf8');
      const dataUploadOptions = {
        blobHTTPHeaders: { blobContentType: 'application/json' },
        overwrite: true
      };
      
      // Use upload method on BlockBlobClient
      await blockBlobClient.upload(buffer, buffer.length, dataUploadOptions);
      console.log('✓ Uploaded data.json to Azure Storage');
    } catch (uploadError) {
      console.error('Error uploading data.json:', uploadError);
      // Continue anyway - might still be able to build
    }

    // Step 3: Run build.js
    const buildScriptPath = join(__dirname, '..', 'build.js');
    const { stdout, stderr } = await execAsync(`node "${buildScriptPath}"`, {
      cwd: join(__dirname, '..')
    });
    
    if (stderr) {
      console.error('Build stderr:', stderr);
    }
    console.log('Build output:', stdout);

    // Step 4: Read the generated index.html
    const indexPath = join(__dirname, '..', 'index.html');
    const htmlContent = readFileSync(indexPath, 'utf8');

    // Step 5: Upload index.html to Azure Storage
    try {
      const htmlBlockBlobClient = containerClient.getBlockBlobClient('index.html');
      const htmlBuffer = Buffer.from(htmlContent, 'utf8');
      const htmlUploadOptions = {
        blobHTTPHeaders: { blobContentType: 'text/html' },
        overwrite: true
      };
      
      // Use upload method on BlockBlobClient
      await htmlBlockBlobClient.upload(htmlBuffer, htmlBuffer.length, htmlUploadOptions);
      console.log('✓ Uploaded index.html to Azure Storage');
    } catch (uploadError) {
      console.error('Error uploading index.html:', uploadError);
      throw new Error(`Failed to upload index.html: ${uploadError.message}`);
    }

    res.json({ success: true, message: 'Site published successfully' });
  } catch (error) {
    console.error('Error publishing:', error);
    res.status(500).json({ error: 'Failed to publish', details: error.message });
  }
});

// Helper function to convert stream to string
async function streamToString(readableStream) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    readableStream.on('data', (data) => {
      chunks.push(data.toString());
    });
    readableStream.on('end', () => {
      resolve(chunks.join(''));
    });
    readableStream.on('error', reject);
  });
}

// Helper function to convert stream to buffer
async function streamToBuffer(readableStream) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    readableStream.on('data', (data) => {
      chunks.push(data instanceof Buffer ? data : Buffer.from(data));
    });
    readableStream.on('end', () => {
      resolve(Buffer.concat(chunks));
    });
    readableStream.on('error', reject);
  });
}

// API: List photos from photos container
app.get('/api/photos', async (req, res) => {
  try {
    // Ensure container exists
    try {
      const createResponse = await photosContainerClient.createIfNotExists({
        access: 'blob' // Public read access for images
      });
      if (createResponse.succeeded) {
        console.log('✓ Created photos container');
      }
    } catch (createError) {
      console.warn('Note: Could not create photos container:', createError.message);
      // Continue anyway - container might already exist
    }

    const photos = [];
    let blobCount = 0;
    
    try {
      // Check if we can access the container
      const containerExists = await photosContainerClient.exists();
      if (!containerExists) {
        throw new Error('Photos container does not exist and could not be created');
      }

      for await (const blob of photosContainerClient.listBlobsFlat()) {
        blobCount++;
        // Only include image files
        const name = blob.name.toLowerCase();
        if (name.match(/\.(jpg|jpeg|png|gif|webp|svg)$/)) {
          const blobClient = photosContainerClient.getBlobClient(blob.name);
          const url = blobClient.url;
          
          photos.push({
            name: blob.name,
            url: url,
            size: blob.properties.contentLength,
            lastModified: blob.properties.lastModified
          });
        }
      }
    } catch (listError) {
      console.error('Error listing blobs:', listError);
      throw new Error(`Failed to list blobs: ${listError.message}`);
    }
    
    // Sort by name
    photos.sort((a, b) => a.name.localeCompare(b.name));
    console.log(`✓ Found ${photos.length} photos out of ${blobCount} total blobs in photos container`);
    res.json(photos);
  } catch (error) {
    console.error('Error listing photos:', error);
    res.status(500).json({ 
      error: 'Failed to list photos', 
      details: error.message,
      hint: 'Make sure the photos container exists and the service principal has proper permissions'
    });
  }
});

// API: Upload photo to photos container
app.post('/api/photos/upload', async (req, res) => {
  try {
    if (!req.body.file || !req.body.filename) {
      return res.status(400).json({ error: 'File data and filename required' });
    }

    const { file, filename } = req.body;
    // Remove data URL prefix if present
    const base64Data = file.includes(',') ? file.split(',')[1] : file;
    const buffer = Buffer.from(base64Data, 'base64');

    // Determine content type from filename
    const ext = filename.toLowerCase().split('.').pop();
    const contentTypes = {
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'webp': 'image/webp',
      'svg': 'image/svg+xml'
    };
    const contentType = contentTypes[ext] || 'application/octet-stream';

    const blockBlobClient = photosContainerClient.getBlockBlobClient(filename);
    const uploadOptions = {
      blobHTTPHeaders: { blobContentType: contentType },
      overwrite: true
    };
    
    // Use upload method on BlockBlobClient
    await blockBlobClient.upload(buffer, buffer.length, uploadOptions);

    res.json({ 
      success: true, 
      message: 'Photo uploaded successfully',
      url: blockBlobClient.url,
      name: filename
    });
  } catch (error) {
    console.error('Error uploading photo:', error);
    res.status(500).json({ error: 'Failed to upload photo', details: error.message });
  }
});

// API: Delete photo from photos container
app.delete('/api/photos/:filename', async (req, res) => {
  try {
    const filename = decodeURIComponent(req.params.filename);
    const blobClient = photosContainerClient.getBlobClient(filename);
    await blobClient.delete();
    res.json({ success: true, message: 'Photo deleted successfully' });
  } catch (error) {
    console.error('Error deleting photo:', error);
    res.status(500).json({ error: 'Failed to delete photo', details: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Editor server running on http://localhost:${PORT}`);
});

