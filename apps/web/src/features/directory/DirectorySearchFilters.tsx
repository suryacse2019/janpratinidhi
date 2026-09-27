import { Search } from "lucide-react";

type Props = {
  query: string;
  type: string;
  state: string;
  party: string;
  states: string[];
  parties: string[];
  onQueryChange: (value: string) => void;
  onTypeChange: (value: string) => void;
  onStateChange: (value: string) => void;
  onPartyChange: (value: string) => void;
  onSubmit: () => void;
};

export function DirectorySearchFilters({
  query,
  type,
  state,
  party,
  states,
  parties,
  onQueryChange,
  onTypeChange,
  onStateChange,
  onPartyChange,
  onSubmit,
}: Props) {
  return (
    <form
      className="representative-search-form"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <div className="dashboard-search-box">
        <Search size={19} aria-hidden="true" />
        <input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Search by name, constituency, state or party"
          aria-label="Search politicians"
        />
        <button type="submit" aria-label="Search politicians">
          <Search size={17} />
          <span>Search</span>
        </button>
      </div>

      <div className="dashboard-filters">
        <label>
          Type
          <select value={type} onChange={(event) => onTypeChange(event.target.value)}>
            <option value="ALL">All</option>
            <option value="MP">MP</option>
            <option value="MLA">MLA</option>
          </select>
        </label>

        <label>
          State
          <select value={state} onChange={(event) => onStateChange(event.target.value)}>
            <option value="">All states</option>
            {states.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>

        <label>
          Party
          <select value={party} onChange={(event) => onPartyChange(event.target.value)}>
            <option value="">All parties</option>
            {parties.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
      </div>
    </form>
  );
}
