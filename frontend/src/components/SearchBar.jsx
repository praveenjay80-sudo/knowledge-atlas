import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiUrl } from "../lib/api";
import { useDebouncedValue } from "../hooks/useDebouncedValue";

function destinationFor(result) {
  if (result.type === "Researcher" && result.slug) {
    return `/researchers/${result.slug}`;
  }
  return `/?focus=${result.id}`;
}

export default function SearchBar() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [error, setError] = useState("");
  const debouncedQuery = useDebouncedValue(query, 200);
  const navigate = useNavigate();

  useEffect(() => {
    if (!debouncedQuery.trim()) {
      setResults([]);
      setError("");
      return;
    }

    let active = true;

    async function runSearch() {
      try {
        const response = await fetch(
          apiUrl(`/search?q=${encodeURIComponent(debouncedQuery.trim())}`)
        );
        if (!response.ok) {
          throw new Error("Search request failed.");
        }
        const data = await response.json();
        if (active) {
          setResults(data);
          setError("");
        }
      } catch (searchError) {
        if (active) {
          setResults([]);
          setError(searchError.message);
        }
      }
    }

    runSearch();

    return () => {
      active = false;
    };
  }, [debouncedQuery]);

  function handleSubmit(event) {
    event.preventDefault();
    if (!results.length) {
      return;
    }
    navigate(destinationFor(results[0]));
    setQuery("");
  }

  return (
    <div className="search-shell">
      <form className="search-bar" onSubmit={handleSubmit}>
        <input
          aria-label="Search graph"
          type="search"
          placeholder="Search thinkers, subfields, or papers"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </form>
      {query.trim() ? (
        <div className="search-results">
          {error ? <p className="search-empty">{error}</p> : null}
          {!error && !results.length ? (
            <p className="search-empty">No matching atlas entries.</p>
          ) : null}
          {results.map((result) => (
            <Link
              className="search-result"
              key={`${result.type}-${result.id}`}
              to={destinationFor(result)}
              onClick={() => setQuery("")}
            >
              <span className={`type-pill type-${result.type.toLowerCase()}`}>
                {result.type}
              </span>
              <strong>{result.label}</strong>
              <span>{result.description || result.related.join(", ")}</span>
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}

