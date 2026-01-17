#!/usr/bin/env node

/**
 * Get Place ID Script
 * 
 * This script helps you find your Google Place ID by searching for the website domain.
 * 
 * Usage:
 *   1. Set your API_KEY below
 *   2. Set WEBSITE domain
 *   3. Run: node get-place-id.js
 * 
 * Or use as a module:
 *   const { getPlaceId } = require('./get-place-id.js');
 *   getPlaceId({ apiKey: 'YOUR_KEY', website: 'example.com' }).then(console.log);
 */

const API_KEY = 'AIzaSyBmPZdZmoInPg7mB6K_YOr44aln1OTIxa8';

// Business information - customize these
const WEBSITE = 'thewhitecottagefloraldesign.com';

/**
 * Find Place ID using text search by website domain only
 */
async function findPlaceIdByWebsite(apiKey, website) {
    // Search using just the website domain
    const searchQuery = website.replace(/^https?:\/\//, '').replace(/^www\./, '');
    const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(searchQuery)}&key=${apiKey}`;
    
    try {
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.status === 'OK' && data.results && data.results.length > 0) {
            // Find the best match by checking if the website matches
            const normalizedWebsite = website.replace(/^https?:\/\//, '').replace(/^www\./, '').toLowerCase();
            
            let match = data.results.find(place => {
                if (!place.website) return false;
                const placeWebsite = place.website.replace(/^https?:\/\//, '').replace(/^www\./, '').toLowerCase();
                return placeWebsite === normalizedWebsite || placeWebsite.includes(normalizedWebsite);
            });
            
            // If no exact website match, return first result (might still be correct)
            if (!match && data.results.length > 0) {
                match = data.results[0];
            }
            
            if (match) {
                return {
                    method: 'website_search',
                    placeId: match.place_id,
                    name: match.name,
                    address: match.formatted_address,
                    rating: match.rating,
                    userRatingsTotal: match.user_ratings_total,
                    website: match.website || 'Not provided'
                };
            }
        }
        
        if (data.status === 'ZERO_RESULTS') {
            return { error: `No results found for website: ${website}` };
        }
        
        return { error: `API error: ${data.status} - ${data.error_message || 'Unknown error'}` };
    } catch (error) {
        return { error: `Request failed: ${error.message}` };
    }
}

/**
 * Get Place ID using website domain only
 */
async function getPlaceId(options = {}) {
    const apiKey = options.apiKey || API_KEY;
    const website = options.website || WEBSITE;
    
    if (!apiKey) {
        throw new Error('API key is required. Set API_KEY in the script or pass it as an option.');
    }
    
    if (!website) {
        throw new Error('Website is required. Set WEBSITE in the script or pass it as an option.');
    }
    
    console.log('🔍 Searching for Place ID by website domain...');
    console.log(`   Website: ${website}`);
    console.log('');
    
    // Search by website only
    console.log('🔎 Searching by website domain...');
    const result = await findPlaceIdByWebsite(apiKey, website);
    
    if (result.error) {
        console.error('❌ Error:', result.error);
        return result;
    }
    
    if (result.placeId) {
        console.log('✅ Found via website search!');
        return result;
    }
    
    return { error: 'Could not find Place ID. Try using the Place ID Finder tool manually.' };
}

/**
 * Main execution (when run directly)
 */
async function main() {
    try {
        const result = await getPlaceId();
        
        console.log('\n' + '='.repeat(60));
        if (result.error) {
            console.error('❌ Failed to find Place ID');
            console.error(`   ${result.error}`);
            process.exit(1);
        } else {
            console.log('✅ SUCCESS! Place ID found:');
            console.log('');
            console.log(`   Place ID: ${result.placeId}`);
            console.log(`   Name: ${result.name}`);
            console.log(`   Address: ${result.address}`);
            if (result.website) {
                console.log(`   Website: ${result.website}`);
            }
            if (result.rating) {
                console.log(`   Rating: ${result.rating} ⭐ (${result.userRatingsTotal} reviews)`);
            }
            console.log(`   Method: ${result.method}`);
            console.log('');
            console.log('📋 Copy this to your script.js:');
            console.log(`   placeId: '${result.placeId}',`);
            console.log('');
        }
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

// Run if executed directly
if (require.main === module) {
    main();
}

// Export for use as module
module.exports = { getPlaceId, findPlaceIdByWebsite };

