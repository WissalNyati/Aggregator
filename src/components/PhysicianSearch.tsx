import { useState } from 'react';
import { Search, LogOut, User, Stethoscope, Copy, Check, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSearchHistory } from '../hooks/useSearchHistory';
import { SearchHistory } from './SearchHistory';

interface SearchResult {
  query: string;
  specialty: string;
  location: string | { formatted_address: string; name?: string; location?: { lat: number; lng: number } } | null;
  results: Array<{
    name: string;
    specialty: string;
    location: string;
    phone: string;
    rating: number;
    years_experience: number;
  }>;
  resultsCount: number;
  error?: string | null;
  suggestions?: string[] | null;
  searchRadius?: number | null;
}

export function PhysicianSearch() {
  const { user, signOut } = useAuth();
  const { addToHistory } = useSearchHistory();
  const [query, setQuery] = useState('');
  const [searchRadius, setSearchRadius] = useState(5); // Default 5km
  const [searching, setSearching] = useState(false);
  const [showHistory, setShowHistory] = useState(true);
  const [searchResults, setSearchResults] = useState<SearchResult | null>(null);
  const [copied, setCopied] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setSearching(true);
    setShowHistory(false);

    try {
      const { searchApi } = await import('../lib/api');
      const radiusInMeters = searchRadius * 1000; // Convert km to meters
      const results = await searchApi.searchPhysicians(query, radiusInMeters);

      // Refresh history (it's automatically saved by the API)
      await addToHistory(
        results.query,
        results.specialty,
        getLocationText(results.location),
        results.resultsCount
      );

      // Store results for display
      setSearchResults(results);
      setQuery('');
      setShowHistory(false);
    } catch (error: any) {
      console.error('Search error:', error);
      
      // Handle specific error cases
      let errorMessage = 'Search failed. Please try again.';
      
      if (error.message?.includes('quota') || error.message?.includes('429')) {
        errorMessage = 'OpenAI API quota exceeded. The search will use fallback results, but they may be limited. Please check your OpenAI account billing.';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      // Display error as a result-like message
      setSearchResults({
        query: query,
        specialty: 'Unknown',
        location: null,
        results: [],
        resultsCount: 0,
        error: errorMessage,
      });
    } finally {
      setSearching(false);
    }
  };

  const handleSelectSearch = (searchQuery: string) => {
    setQuery(searchQuery);
    setShowHistory(false);
    setSearchResults(null);
  };

  // Helper function to get location text
  const getLocationText = (location: SearchResult['location']): string => {
    if (!location) return 'Not specified';
    if (typeof location === 'string') return location;
    return location.formatted_address || 'Not specified';
  };

  const formatResultsText = (results: SearchResult): string => {
    if (results.error) {
      let errorText = `Search Error: ${results.error}

Search Query: "${results.query}"

Search Details:
- Specialty: ${results.specialty}
- Location: ${getLocationText(results.location) || 'Not specified'}`;

      if (results.suggestions && results.suggestions.length > 0) {
        errorText += `\n\nSuggestions:\n${results.suggestions.map(s => `• ${s}`).join('\n')}`;
      } else {
        errorText += `\n\nPlease try again or contact support if the issue persists.`;
      }

      return errorText;
    }

    if (results.resultsCount === 0) {
      const locationText = getLocationText(results.location) || 'your area';
      const radiusText = results.searchRadius ? ` (within ${results.searchRadius / 1000}km)` : '';
      
      let noResultsText = `No physicians found matching "${results.query}"

Search Details:
- Specialty: ${results.specialty}
- Location: ${locationText}${radiusText}`;

      if (results.suggestions && results.suggestions.length > 0) {
        noResultsText += `\n\nSuggestions:\n${results.suggestions.map(s => `• ${s}`).join('\n')}`;
      } else {
        noResultsText += `\n\nSuggestions to improve your search:
• Try a broader location (e.g., "Seattle" instead of "Seattle Downtown")
• Use more general specialty terms (e.g., "Cardiologist" instead of "Interventional Cardiologist")
• Remove specific physician names if searching by specialty
• Try searching by city and state (e.g., "Retina Surgeons in Tacoma, WA")
• Check spelling of location or specialty names
• Expand your search radius to include a wider area`;
      }

      return noResultsText;
    }

    const resultsText = results.results
      .map((p, i) => `${i + 1}. ${p.name} - ${p.specialty}\n   ${p.location} | ${p.phone} | ⭐ ${p.rating}/5`)
      .join('\n\n');

    const locationText = getLocationText(results.location);

    return `Found ${results.resultsCount} physician${results.resultsCount !== 1 ? 's' : ''} matching "${results.query}"

Search Details:
- Specialty: ${results.specialty}
- Location: ${locationText}

Results:

${resultsText}`;
  };

  const handleCopyResults = async () => {
    if (!searchResults) return;
    
    const textToCopy = formatResultsText(searchResults);
    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50">
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="bg-white shadow-sm border border-gray-200 rounded-2xl p-6 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="bg-blue-600 p-2 rounded-xl">
                <Stethoscope className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  AI Physician Search
                </h1>
                <p className="text-sm text-gray-600">
                  Find the right physician for your needs
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <User className="w-4 h-4" />
                <span>{user?.email}</span>
              </div>
              <button
                onClick={signOut}
                className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </button>
            </div>
          </div>
        </div>

        <div className="bg-white shadow-lg border border-gray-200 rounded-2xl p-8 mb-6">
          <form onSubmit={handleSearch} className="space-y-4">
            <div>
              <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-2">
                Search for physicians
              </label>
              <div className="relative">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  id="search"
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder='Try "Retina Surgeons in Tacoma" or "Dr. Smith Orthopedic Kansas City"'
                  className="w-full pl-12 pr-4 py-4 text-lg border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  disabled={searching}
                />
              </div>
            </div>

            <div>
              <label htmlFor="radius" className="block text-sm font-medium text-gray-700 mb-2">
                Search Radius: {searchRadius} km
              </label>
              <div className="flex items-center gap-4">
                <input
                  id="radius"
                  type="range"
                  min="1"
                  max="50"
                  value={searchRadius}
                  onChange={(e) => setSearchRadius(Number(e.target.value))}
                  className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                  disabled={searching}
                />
                <div className="flex gap-2 text-sm text-gray-600">
                  <span className="w-8 text-center">1km</span>
                  <span className="w-8 text-center">25km</span>
                  <span className="w-8 text-center">50km</span>
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Expand the radius to search in a wider area around your location
              </p>
            </div>

            <button
              type="submit"
              disabled={searching || !query.trim()}
              className="w-full bg-blue-600 text-white py-4 rounded-xl font-medium hover:bg-blue-700 focus:ring-4 focus:ring-blue-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {searching ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Searching...
                </>
              ) : (
                <>
                  <Search className="w-5 h-5" />
                  Search Physicians
                </>
              )}
            </button>
          </form>

          <div className="mt-6 p-4 bg-blue-50 rounded-lg">
            <p className="text-sm text-gray-700">
              <span className="font-medium">Pro tip:</span> You can search by specialty, location, physician name, or a combination. Our AI will understand your intent and find the best matches.
            </p>
          </div>
        </div>

        {searchResults && (
          <div className="bg-white shadow-lg border border-gray-200 rounded-2xl p-8 mb-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                {searchResults.resultsCount === 0 ? (
                  <AlertCircle className="w-6 h-6 text-amber-500" />
                ) : (
                  <Stethoscope className="w-6 h-6 text-blue-600" />
                )}
                <h2 className="text-xl font-bold text-gray-900">
                  {searchResults.resultsCount === 0 ? 'No Results Found' : 'Search Results'}
                </h2>
              </div>
              <button
                onClick={handleCopyResults}
                className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors border border-gray-300"
                title="Copy results to clipboard"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 text-green-600" />
                    <span className="text-green-600">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>

            <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
              <pre className="whitespace-pre-wrap font-mono text-sm text-gray-800 leading-relaxed">
                {formatResultsText(searchResults)}
              </pre>
            </div>

            {searchResults.suggestions && searchResults.suggestions.length > 0 && (
              <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <h3 className="text-sm font-semibold text-blue-900 mb-2">💡 Suggestions:</h3>
                <ul className="list-disc list-inside space-y-1 text-sm text-blue-800">
                  {searchResults.suggestions.map((suggestion, index) => (
                    <li key={index}>{suggestion}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="mt-4 flex gap-3">
              <button
                onClick={() => {
                  setSearchResults(null);
                  setShowHistory(true);
                }}
                className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors border border-gray-300"
              >
                New Search
              </button>
            </div>
          </div>
        )}

        {showHistory && !searchResults && <SearchHistory onSelectSearch={handleSelectSearch} />}
      </div>
    </div>
  );
}
