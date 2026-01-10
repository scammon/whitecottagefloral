# White Cottage Floral Design - Static Website

A beautiful, modern static website for White Cottage Floral Design, designed to be hosted on Azure Storage with images served from Azure Storage.

## Files Structure

```
.
├── index.html          # Generated HTML file (built from template)
├── index.template.html # HTML template with placeholders
├── data.json           # All text content in JSON format
├── build.js            # Build script to generate index.html
├── styles.css          # All styling
├── script.js           # Interactive functionality
├── package.json        # Node.js dependencies and scripts
└── README.md           # This file
```

## Setup Instructions

### 1. Azure Storage Account Setup

1. **Create an Azure Storage Account** (if you don't have one):
   - Go to Azure Portal
   - Create a new Storage Account
   - Enable "Static website hosting" in the Storage Account settings
   - Set `index.html` as the index document
   - Set `404.html` (or `index.html`) as the error document

2. **Create a container for images**:
   - Create a container named `images` (or your preferred name)
   - Set the access level to "Blob" (public read access for images)

3. **Upload your images**:
   - Upload all your images to the images container
   - Note the URLs of your images (format: `https://[storage-account-name].blob.core.windows.net/images/[image-name].jpg`)

### 2. Update Image URLs

Replace all instances of `YOUR_AZURE_STORAGE_URL` in `index.html` with your actual Azure Storage URL.

**Example:**
```html
<!-- Before -->
<img src="YOUR_AZURE_STORAGE_URL/hero-image.jpg" alt="Beautiful floral arrangement">

<!-- After -->
<img src="https://yourstorageaccount.blob.core.windows.net/images/hero-image.jpg" alt="Beautiful floral arrangement">
```

**Images to update:**
- Hero image: `hero-image.jpg`
- About image: `about-image.jpg`
- Portfolio images: `portfolio-1.jpg` through `portfolio-6.jpg` (or as many as you have)

### 3. Customize Content

**Using the Template System (Recommended):**

All text content is now stored in `data.json`, making it much easier to edit! Simply:

1. **Edit `data.json`** - Update any text content you want to change
2. **Run the build script** - Execute `npm run build` or `node build.js`
3. **The updated `index.html` will be generated automatically**

**Example:** To change the hero tagline, edit `data.json`:
```json
"hero": {
  "tagline": "your new tagline here"
}
```

Then run `npm run build` to regenerate `index.html`.

**What you can edit in `data.json`:**
- All text content (headings, paragraphs, descriptions)
- Navigation labels
- Service items (add/remove/edit services)
- Portfolio images (add/remove images)
- Standards list items
- Contact information
- Social media links
- Image paths and alt text

**Manual Editing (Alternative):**

If you prefer to edit HTML directly, you can still edit `index.html`, but remember to run `npm run build` after making changes to `data.json` to regenerate the HTML.

### 4. Build the Site

Before deploying, make sure to build the site:

```bash
# Install dependencies (if needed)
npm install

# Build the site (generates index.html from template)
npm run build
```

This will generate `index.html` from `index.template.html` using the content in `data.json`.

**Watch Mode (Optional):**
For development, you can use watch mode to automatically rebuild when files change:
```bash
npm run watch
```

### 5. Deploy to Azure Storage

**Option A: Using Azure Portal**
1. Go to your Storage Account
2. Navigate to "Static website" settings
3. Upload `index.html`, `styles.css`, and `script.js` to the `$web` container
4. Your site will be available at: `https://[storage-account-name].z13.web.core.windows.net`

**Option B: Using Azure CLI**
```bash
# Login to Azure
az login

# Set your storage account name
STORAGE_ACCOUNT="your-storage-account-name"

# Upload files to $web container
az storage blob upload-batch \
  --account-name $STORAGE_ACCOUNT \
  --source . \
  --destination '$web' \
  --pattern '*.html' \
  --content-type 'text/html'

az storage blob upload-batch \
  --account-name $STORAGE_ACCOUNT \
  --source . \
  --destination '$web' \
  --pattern '*.css' \
  --content-type 'text/css'

az storage blob upload-batch \
  --account-name $STORAGE_ACCOUNT \
  --source . \
  --destination '$web' \
  --pattern '*.js' \
  --content-type 'application/javascript'
```

**Option C: Using Azure Storage Explorer**
1. Download Azure Storage Explorer
2. Connect to your Storage Account
3. Navigate to the `$web` container
4. Upload `index.html`, `styles.css`, and `script.js`

### 6. Custom Domain (Optional)

To use a custom domain:
1. Go to your Storage Account → "Custom domain" settings
2. Add your domain
3. Configure DNS CNAME record pointing to your Azure Storage endpoint
4. Enable HTTPS (requires Azure CDN or similar)

### 7. Google Reviews Setup (Testimonials)

The testimonials section now pulls 5-star reviews from Google Reviews. **For static sites, you'll need to put the API key directly in the code** (see Option B below).

**Option A: Using Backend Proxy** (Only if you have a backend server)

If you have a backend server (like Azure Functions, or the editor server), you can use a proxy endpoint to keep your API key secure:

1. Get your API key and Place ID (see Option B, steps 1-2)
2. Configure your backend to proxy requests (see `editor/server.js` for an example)
3. Set `proxyEndpoint` in `script.js` to your backend URL

**Option B: Direct API Calls** (For Static Sites - Recommended)

Since this is a static site, you'll put the API key directly in `script.js`. **This is safe IF you properly restrict the API key.**

1. **Get a Google Places API Key:**
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or select an existing one
   - Enable the "Places API" (or "Places API (New)")
   - Go to "Credentials" > "Create Credentials" > "API Key"
   - Copy your API key

2. **Find your Place ID:**
   - Use the [Place ID Finder](https://developers.google.com/maps/documentation/places/web-service/place-id#find-id)
   - Search for "White Cottage Floral Design" or "thewhitecottagefloraldesign.com"
   - Copy the Place ID from the result

3. **CRITICAL: Restrict your API key** (Required for security):
   - In Google Cloud Console, go to: **APIs & Services > Credentials**
   - Click on your API key
   - Under **"Application restrictions"**:
     - Select **"HTTP referrers (web sites)"**
     - Add your domain(s):
       - `https://your-domain.com/*`
       - `https://*.your-domain.com/*`
       - `https://your-storage-account.z13.web.core.windows.net/*` (if using Azure Storage)
   - Under **"API restrictions"**:
     - Select **"Restrict key"**
     - Check only **"Places API"** (or "Places API (New)")
   - Click **"Save"**
   
   ⚠️ **Without these restrictions, anyone can use your API key and you may be charged for their usage!**

4. **Update script.js:**
   - Open `script.js`
   - Find the `GOOGLE_PLACES_CONFIG` object
   - Set your `apiKey` and `placeId`:
     ```javascript
     apiKey: 'AIzaSyAbCdEfGhIjKlMnOpQrStUvWxYz1234567',
     placeId: 'ChIJN1t_tDeuEmsRUsoyG83frY4'
     ```

**Note:** If the API is not configured, the site will show a fallback testimonial.

### 8. Contact Form Setup

The contact form currently uses client-side JavaScript. For a production site, you'll want to:

**Option 1: Azure Functions**
- Create an Azure Function to handle form submissions
- Update the form submission handler in `script.js` to POST to your function endpoint

**Option 2: Third-party Service**
- Use services like Formspree, Netlify Forms, or similar
- Update the form action in `index.html`

**Option 3: Static Email Link**
- Replace the form with a mailto link or simple email address

## Image Recommendations

For best results, use images with these specifications:
- **Hero image**: 1200x800px or larger, landscape orientation
- **About image**: 800x1000px or larger, portrait orientation
- **Portfolio images**: 1000x1000px (square) or 1200x800px (landscape)
- **Format**: JPG or WebP for photos, PNG for graphics
- **Optimization**: Compress images before uploading to reduce load times

## Browser Support

This website is compatible with:
- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)
- Mobile browsers (iOS Safari, Chrome Mobile)

## Customization

### Editing Content (Template System)

**All text content is in `data.json`** - this makes editing much simpler!

1. **Edit `data.json`** with your changes
2. **Run `npm run build`** to regenerate `index.html`
3. **Deploy** the updated files

**Common edits:**
- **Change hero text**: Edit `hero.title`, `hero.tagline`, etc. in `data.json`
- **Update about section**: Edit `about.intro` and `about.text`
- **Add/remove services**: Edit the `services.items` array
- **Add/remove portfolio images**: Edit the `portfolio.images` array
- **Update standards list**: Edit the `standards.items` array
- **Change contact info**: Edit `contact.label` and `contact.description`

**Example - Adding a new service:**
```json
"services": {
  "items": [
    {
      "title": "Wedding Florals",
      "description": "..."
    },
    {
      "title": "Your New Service",
      "description": "Description here"
    }
  ]
}
```

### Colors
Edit the CSS variables in `styles.css`:
```css
:root {
    --primary-color: #2c2c2c;
    --accent-color: #d4a574;
    /* ... */
}
```

### Fonts
The site uses Google Fonts (Playfair Display & Inter). To change fonts, update the font imports in `index.template.html` and the font-family variables in `styles.css`.

## Notes

- All image paths use Azure Storage blob URLs
- The site is fully responsive and mobile-friendly
- Smooth scrolling is enabled for navigation
- Form validation is client-side only (add server-side validation for production)

## Support

For issues or questions about Azure Storage static website hosting, refer to:
- [Azure Static Website Hosting Documentation](https://docs.microsoft.com/azure/storage/blobs/storage-blob-static-website)
