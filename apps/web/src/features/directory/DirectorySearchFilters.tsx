import { useEffect, useId, useRef, useState } from "react";
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
          placeholder="Search by MP/MLA/MLC name, state, district, constituency or party"
          aria-label="Search politicians"
        />
        <button type="submit" aria-label="Search politicians">
          <Search size={17} />
          <span>Search</span>
        </button>
      </div>

      <div className="dashboard-filters">
        <SearchableFilter
          label="Type"
          value={type}
          allValue="ALL"
          allLabel="All types"
          options={["MP", "MLA", "MLC"]}
          onChange={onTypeChange}
        />
        <SearchableFilter
          label="State"
          value={state}
          allLabel="All states"
          options={states}
          onChange={onStateChange}
        />
        <SearchableFilter
          label="Party"
          value={party}
          allLabel="All parties"
          options={parties}
          onChange={onPartyChange}
        />
      </div>
    </form>
  );
}

function SearchableFilter({
  label,
  value,
  allValue = "",
  allLabel,
  options,
  onChange,
}: {
  label: string;
  value: string;
  allValue?: string;
  allLabel: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [active, setActive] = useState(-1);
  const list = useRef<HTMLDivElement>(null);
  const unique = Array.from(
    new Map(options.map((item) => [item.trim().toLocaleLowerCase(), item.trim()])).values(),
  )
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));
  const filtered = unique.filter((item) =>
    item.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()),
  );
  const choices = [
    { value: allValue, label: allLabel },
    ...filtered.map((item) => ({ value: item, label: item })),
  ];
  const close = () => {
    setOpen(false);
    setSearch("");
    setActive(-1);
  };
  const select = (next: string) => {
    onChange(next);
    close();
  };

  useEffect(() => {
    setSearch("");
    setActive(-1);
  }, [value]);
  useEffect(() => {
    if (open && active >= 0) list.current?.children[active]?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  return (
    <label htmlFor={id}>
      {label}
      <div className="directory-party-picker">
        <input
          id={id}
          className="directory-party-search"
          type="search"
          value={open ? search : value === allValue ? "" : value}
          placeholder={
            open
              ? `Search ${label.toLowerCase()}…`
              : value === allValue
                ? `${allLabel} · search`
                : value
          }
          onFocus={() => setOpen(true)}
          onClick={() => setOpen(true)}
          onBlur={close}
          onChange={(event) => {
            setSearch(event.target.value);
            setActive(-1);
            setOpen(true);
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              close();
            }
            if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              event.preventDefault();
              setOpen(true);
              setActive((current) =>
                event.key === "ArrowDown"
                  ? Math.min(current + 1, choices.length - 1)
                  : current < 0
                    ? choices.length - 1
                    : Math.max(current - 1, 0),
              );
            }
            if (event.key === "Enter" && open) {
              event.preventDefault();
              if (active >= 0 && choices[active]) select(choices[active].value);
              else if (filtered.length === 1) select(filtered[0]);
            }
          }}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={`${id}-options`}
          aria-activedescendant={open && active >= 0 ? `${id}-option-${active}` : undefined}
        />
        {open && (
          <div
            ref={list}
            className="directory-party-options"
            id={`${id}-options`}
            role="listbox"
            aria-label={label}
          >
            {choices.map((item, index) => (
              <button
                key={item.value}
                id={`${id}-option-${index}`}
                type="button"
                role="option"
                tabIndex={-1}
                aria-selected={value === item.value}
                data-active={active === index}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => select(item.value)}
              >
                {item.label}
              </button>
            ))}
            {filtered.length === 0 && (
              <span className="directory-party-empty" role="status">
                No matching options
              </span>
            )}
          </div>
        )}
      </div>
    </label>
  );
}
