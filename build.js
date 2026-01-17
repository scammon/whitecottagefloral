#!/usr/bin/env node

/**
 * Simple static site builder
 * Reads data.json and index.template.html, then generates index.html
 */

const fs = require('fs');
const path = require('path');

// Read data file
const dataPath = path.join(__dirname, 'data.json');
const templatePath = path.join(__dirname, 'index.template.html');
const outputPath = path.join(__dirname, 'index.html');

// Load data
const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

// Load template
let template = fs.readFileSync(templatePath, 'utf8');

// Helper function to get nested value from object using dot notation
function getValue(obj, path) {
    return path.split('.').reduce((current, prop) => current && current[prop], obj);
}

// Replace simple placeholders like {{site.title}}
template = template.replace(/\{\{([^#\/].*?)\}\}/g, (match, key) => {
    const value = getValue(data, key.trim());
    return value !== undefined ? value : match;
});

// Handle Handlebars-style loops {{#each array}}...{{/each}}
// Process each blocks
const eachRegex = /\{\{#each\s+([^}]+)\}\}([\s\S]*?)\{\{\/each\}\}/g;
let match;
while ((match = eachRegex.exec(template)) !== null) {
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
        template = template.replace(match[0], rendered);
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
        const sectionMatch = template.match(sectionRegex);
        
        if (sectionMatch) {
            // Replace the inner content with custom HTML, keeping the opening and closing tags
            template = template.replace(sectionRegex, (match, innerContent) => {
                return match.replace(innerContent, customHtml);
            });
            console.log(`✓ Using custom HTML for ${section.path} section`);
        }
    }
});

// Write output
fs.writeFileSync(outputPath, template, 'utf8');
console.log('✓ Built index.html from template');

