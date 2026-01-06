# White Cottage Floral Design - Static Website

A beautiful, modern static website for White Cottage Floral Design, designed to be hosted on Azure Storage with images served from Azure Storage.

## Files Structure

```
.
├── index.html      # Main HTML file
├── styles.css      # All styling
├── script.js       # Interactive functionality
└── README.md       # This file
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

Update the following in `index.html`:

1. **About Section**: Replace `[Your Name]` with your actual name
2. **Contact Information**: Update contact details in the footer and contact section
3. **Social Media**: Update the Instagram handle `@whitecottagefloral` if different
4. **Testimonials**: Replace with your actual client testimonials
5. **Services**: Customize service descriptions to match your offerings
6. **Location**: Update locations if different

### 4. Deploy to Azure Storage

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

### 5. Custom Domain (Optional)

To use a custom domain:
1. Go to your Storage Account → "Custom domain" settings
2. Add your domain
3. Configure DNS CNAME record pointing to your Azure Storage endpoint
4. Enable HTTPS (requires Azure CDN or similar)

### 6. Contact Form Setup

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
The site uses Google Fonts (Playfair Display & Inter). To change fonts, update the font imports in `index.html` and the font-family variables in `styles.css`.

## Notes

- All image paths use Azure Storage blob URLs
- The site is fully responsive and mobile-friendly
- Smooth scrolling is enabled for navigation
- Form validation is client-side only (add server-side validation for production)

## Support

For issues or questions about Azure Storage static website hosting, refer to:
- [Azure Static Website Hosting Documentation](https://docs.microsoft.com/azure/storage/blobs/storage-blob-static-website)
