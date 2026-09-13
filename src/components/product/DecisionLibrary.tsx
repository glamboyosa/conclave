import { useState } from "react";
import { Download, FileText, Plus, Search, Trash2 } from "lucide-react";
import { Button } from "../ui/button";
import type { DecisionRecord } from "../../storage";

type Props = {
  records: DecisionRecord[];
  onOpen: (record: DecisionRecord) => void;
  onExport: (record: DecisionRecord) => void;
  onNew: () => void;
  onDelete: (record: DecisionRecord) => void;
};

export const DecisionLibrary = ({
  records,
  onOpen,
  onExport,
  onNew,
  onDelete,
}: Props) => {
  const [query, setQuery] = useState("");

  const matches = records.filter((record) =>
    `${record.result.title} ${record.brief} ${record.result.verdict}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );

  return (
    <section className="library-view">
      <h1>Library</h1>
      <p className="lede">
        Saved in this browser. Export a memo to keep a copy.
      </p>
      {records.length > 0 && (
        <div className="library-search">
          <Search size={17} />
          <input
            aria-label="Search decisions"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search briefs and recommendations…"
          />
          <span>
            {matches.length} / {records.length}
          </span>
        </div>
      )}
      {matches.length ? (
        <div className="library-list">
          {matches.map((record) => (
            <article key={record.id}>
              <button onClick={() => onOpen(record)}>
                <span>
                  {new Date(record.createdAt).toLocaleDateString()} ·{" "}
                  {record.result.mode === "local"
                    ? "Offline preview"
                    : "Live council"}
                </span>
                <strong>{record.result.title}</strong>
                <p>{record.brief}</p>
                <small>{record.result.verdict}</small>
              </button>
              <div className="library-actions">
                <Button
                  variant="ghost"
                  aria-label={`Export ${record.result.title} as Markdown`}
                  onClick={() => onExport(record)}
                >
                  <Download data-icon="inline-start" /> Markdown
                </Button>
                <Button
                  variant="ghost"
                  aria-label={`Delete ${record.result.title}`}
                  onClick={() => onDelete(record)}
                >
                  <Trash2 data-icon="inline-start" /> Delete
                </Button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="empty-library">
          <FileText size={24} />
          <strong>
            {query && records.length ? "No matching decisions" : "No saved decisions yet"}
          </strong>
          <p>
            {query && records.length
              ? "Try another phrase from the brief or recommendation."
              : "Completed councils appear here. The most recent 50 stay on this device."}
          </p>
          {(!query || !records.length) && (
            <Button onClick={onNew}>
              <Plus data-icon="inline-start" />
              Start a decision
            </Button>
          )}
        </div>
      )}
    </section>
  );
};
