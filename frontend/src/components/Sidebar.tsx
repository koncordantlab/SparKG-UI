'use client'

interface Dataset {
  id: string
  full_id: string
}

interface Table {
  id: string
  type: string
  full_id: string
}

interface SidebarProps {
  datasets: Dataset[]
  tables: Table[]
  selectedDataset: string | null
  selectedTable: string | null
  onSelectDataset: (id: string) => void
  onSelectTable: (id: string) => void
}

export default function Sidebar({
  datasets,
  tables,
  selectedDataset,
  selectedTable,
  onSelectDataset,
  onSelectTable,
}: SidebarProps) {
  return (
    <aside className="w-64 bg-gray-800 text-white min-h-screen p-4">
      <h2 className="text-lg font-semibold mb-4">Datasets</h2>

      <div className="space-y-2">
        {datasets.map((dataset) => (
          <div key={dataset.id}>
            <button
              onClick={() => onSelectDataset(dataset.id)}
              className={`w-full text-left px-3 py-2 rounded transition-colors ${
                selectedDataset === dataset.id
                  ? 'bg-blue-600'
                  : 'hover:bg-gray-700'
              }`}
            >
              {dataset.id}
            </button>

            {selectedDataset === dataset.id && tables.length > 0 && (
              <div className="ml-4 mt-2 space-y-1">
                {tables.map((table) => (
                  <button
                    key={table.id}
                    onClick={() => onSelectTable(table.id)}
                    className={`w-full text-left px-3 py-1 text-sm rounded transition-colors ${
                      selectedTable === table.id
                        ? 'bg-blue-500'
                        : 'hover:bg-gray-600'
                    }`}
                  >
                    {table.id}
                    <span className="text-xs text-gray-400 ml-2">
                      ({table.type})
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {datasets.length === 0 && (
        <p className="text-gray-400 text-sm">No datasets found</p>
      )}
    </aside>
  )
}
