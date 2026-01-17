# Template System Guide

This website uses a simple templating system to make editing text content much easier while keeping the site fully static.

## Quick Start

1. **Edit content** in `data.json`
2. **Build the site**: `npm run build` or `node build.js`
3. **Deploy** the generated `index.html`

## How It Works

- **`data.json`** - Contains all text content in a structured JSON format
- **`index.template.html`** - HTML template with placeholders like `{{site.title}}`
- **`build.js`** - Simple script that combines the template and data to generate `index.html`

## Editing Examples

### Change the Hero Title

In `data.json`, find:
```json
"hero": {
  "title": "white cottage<br>floral design"
}
```

Change it to:
```json
"hero": {
  "title": "your new title<br>here"
}
```

Then run `npm run build`.

### Update the About Section

Edit `data.json`:
```json
"about": {
  "intro": "Hi, I'm Susan.",
  "text": "Your new about text here..."
}
```

### Add a New Service

In `data.json`, add to the `services.items` array:
```json
"services": {
  "items": [
    {
      "title": "Wedding Florals",
      "description": "..."
    },
    {
      "title": "New Service",
      "description": "Description of new service"
    }
  ]
}
```

### Add a Portfolio Image

In `data.json`, add to the `portfolio.images` array:
```json
"portfolio": {
  "images": [
    {
      "src": "new-image.jpg",
      "alt": "Description of image"
    }
  ]
}
```

### Update Contact Information

Edit `data.json`:
```json
"contact": {
  "label": "Your Business Name",
  "description": "Your description here<br>with line breaks"
}
```

## Template Syntax

- **Simple replacement**: `{{site.title}}` - Replaces with the value from `data.site.title`
- **Nested values**: `{{hero.image.src}}` - Accesses nested properties
- **Arrays/Loops**: Use `{{#each array}}...{{/each}}` to loop through arrays
  - Inside loops, use `{{this.property}}` to access item properties
  - For simple arrays (strings), use `{{this}}`

## Tips

- Always run `npm run build` after editing `data.json`
- Keep `index.template.html` for structure changes
- Edit `data.json` for all text content
- The generated `index.html` is what gets deployed
- You can still edit `index.html` directly, but changes will be overwritten on the next build

## Watch Mode (Development)

For automatic rebuilding during development:
```bash
npm run watch
```

This will watch `data.json` and `index.template.html` and rebuild automatically when they change.

