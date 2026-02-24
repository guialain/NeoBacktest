import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid
} from "recharts";

export default function EquityChart({ data }) {
  return (
    <div className="neo-card">
      <h3>Equity Curve</h3>

      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={data}>
          <CartesianGrid stroke="rgba(255,255,255,0.05)" />
          <XAxis dataKey="timestamp" hide />
          <YAxis />
          <Tooltip />
          <Line
            type="monotone"
            dataKey="equity"
            stroke="#00ffb3"
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
