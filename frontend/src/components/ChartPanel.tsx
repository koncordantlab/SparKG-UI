'use client'

import { useMemo } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts'

interface ChartPanelProps {
  data: Record<string, unknown>[]
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8']

export default function ChartPanel({ data }: ChartPanelProps) {
  const { numericColumns, categoryColumns } = useMemo(() => {
    if (!data || data.length === 0) {
      return { numericColumns: [], categoryColumns: [] }
    }

    const columns = Object.keys(data[0])
    const numeric: string[] = []
    const category: string[] = []

    columns.forEach((col) => {
      const sampleValue = data[0][col]
      if (typeof sampleValue === 'number') {
        numeric.push(col)
      } else if (typeof sampleValue === 'string') {
        category.push(col)
      }
    })

    return { numericColumns: numeric, categoryColumns: category }
  }, [data])

  const barChartData = useMemo(() => {
    if (numericColumns.length === 0 || categoryColumns.length === 0) {
      return null
    }
    return data.slice(0, 10).map((row) => ({
      name: String(row[categoryColumns[0]]).slice(0, 20),
      value: Number(row[numericColumns[0]]) || 0,
    }))
  }, [data, numericColumns, categoryColumns])

  const pieChartData = useMemo(() => {
    if (numericColumns.length === 0 || categoryColumns.length === 0) {
      return null
    }
    return data.slice(0, 5).map((row) => ({
      name: String(row[categoryColumns[0]]).slice(0, 15),
      value: Math.abs(Number(row[numericColumns[0]]) || 0),
    }))
  }, [data, numericColumns, categoryColumns])

  if (!barChartData || !pieChartData) {
    return (
      <div className="bg-white rounded-lg shadow p-4">
        <p className="text-gray-500">
          Charts require at least one numeric and one text column.
        </p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="bg-white rounded-lg shadow p-4">
        <h3 className="text-lg font-medium mb-4">Bar Chart</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={barChartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="value" fill="#0088FE" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-white rounded-lg shadow p-4">
        <h3 className="text-lg font-medium mb-4">Pie Chart</h3>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={pieChartData}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, percent }) =>
                `${name} (${(percent * 100).toFixed(0)}%)`
              }
              outerRadius={80}
              fill="#8884d8"
              dataKey="value"
            >
              {pieChartData.map((_, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={COLORS[index % COLORS.length]}
                />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
