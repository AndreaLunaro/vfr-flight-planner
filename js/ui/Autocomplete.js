import { GeocodingService } from '../services/GeocodingService.js';

export class Autocomplete {
    constructor() {
        this.timeout = null;
        this.abortController = null;
        this.currentInput = null;
    }

    setup(inputElement) {
        const autocompleteContainer = document.createElement('div');
        autocompleteContainer.className = 'autocomplete-suggestions';
        autocompleteContainer.style.display = 'none';

        // Ensure parent is relative for positioning
        if (getComputedStyle(inputElement.parentElement).position === 'static') {
            inputElement.parentElement.style.position = 'relative';
        }

        inputElement.parentElement.appendChild(autocompleteContainer);

        // Input handler
        inputElement.addEventListener('input', (e) => {
            const query = e.target.value.trim();

            // Clear previous coordinates when user types
            delete inputElement.dataset.lat;
            delete inputElement.dataset.lon;

            if (query.length < 2) {
                autocompleteContainer.style.display = 'none';
                return;
            }

            // Cancel previous request
            if (this.abortController) {
                this.abortController.abort();
            }

            clearTimeout(this.timeout);
            this.timeout = setTimeout(async () => {
                this.abortController = new AbortController();
                const signal = this.abortController.signal;

                try {
                    // Show loading state
                    autocompleteContainer.innerHTML = '<div class="autocomplete-loading">Searching...</div>';
                    autocompleteContainer.style.display = 'block';

                    const suggestions = await this.getSuggestions(query, signal);

                    if (!signal.aborted) {
                        this.displaySuggestions(suggestions, autocompleteContainer, inputElement);
                    }
                } catch (error) {
                    if (error.name !== 'AbortError') {
                        console.error('Autocomplete error:', error);
                        autocompleteContainer.style.display = 'none';
                    }
                }
            }, 300); // Increased debounce to 300ms
        });

        // Focus handler
        inputElement.addEventListener('focus', () => {
            this.currentInput = inputElement;
            // Close other autocompletes
            document.querySelectorAll('.autocomplete-suggestions').forEach(el => {
                if (el !== autocompleteContainer) el.style.display = 'none';
            });
        });

        // Click outside handler
        document.addEventListener('click', (e) => {
            if (!inputElement.contains(e.target) && !autocompleteContainer.contains(e.target)) {
                autocompleteContainer.style.display = 'none';
            }
        });
    }

    async getSuggestions(query, signal) {
        try {
            const italianQuery = `${query}, Italia`;

            // Run both searches in parallel with signal
            const [italianResults, worldResults] = await Promise.all([
                GeocodingService.searchLocation(italianQuery, true, signal),
                GeocodingService.searchLocation(query, false, signal)
            ]);

            const combined = [...italianResults, ...worldResults];
            return this.removeDuplicateSuggestions(combined).slice(0, 5);
        } catch (error) {
            throw error;
        }
    }

    removeDuplicateSuggestions(suggestions) {
        const seen = new Set();
        return suggestions.filter(suggestion => {
            const key = `${suggestion.lat.toFixed(4)},${suggestion.lon.toFixed(4)}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    }

    displaySuggestions(suggestions, container, inputElement) {
        if (suggestions.length === 0) {
            container.innerHTML = '<div class="autocomplete-no-results">No results found</div>';
            return;
        }

        container.innerHTML = '';
        container.style.display = 'block';

        suggestions.forEach(suggestion => {
            const div = document.createElement('div');
            div.className = 'autocomplete-item';
            div.innerHTML = `
                <div class="suggestion-main">${suggestion.shortName}</div>
                <div class="suggestion-sub">${suggestion.name}</div>
            `;

            div.addEventListener('click', () => {
                inputElement.value = suggestion.shortName;
                container.style.display = 'none';
                inputElement.dataset.lat = suggestion.lat;
                inputElement.dataset.lon = suggestion.lon;

                // Dispatch event to notify listeners (like map)
                inputElement.dispatchEvent(new Event('change'));
            });
            container.appendChild(div);
        });
    }
}
