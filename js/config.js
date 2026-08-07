/**
 * Site-wide config.
 * Change API_BASE_URL to your deployed backend's URL once it's live on Render.
 * Example: 'https://silver-taxi-backend.onrender.com/api'
 */
window.API_BASE_URL = 'https://backendtaxiweb.onrender.com/api';

/**
 * Google Maps API key - powers the address autocomplete on the booking form
 * (Pickup Address / Destination Address fields).
 *
 * 1. Go to https://console.cloud.google.com/google/maps-apis
 * 2. Create/select a project, enable the "Places API" and "Maps JavaScript API"
 * 3. Create an API key
 * 4. Paste the key below. Once your domain is live, come back and restrict the
 *    key to that domain under Credentials > Application restrictions.
 */
window.GOOGLE_MAPS_API_KEY = 'AIzaSyA3Fa193c9wzaUPv1uT7m6aj7Kb5v_616I';