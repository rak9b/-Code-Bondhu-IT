# NexusERP — Enterprise Resource Planning System

A modern, responsive, and secure Mini ERP System built with **React**, **Vite**, **TypeScript**, **Tailwind CSS**, **Radix UI**, and **Supabase**.

## 🚀 Features

- 🔐 **Authentication & Protected Routing**: Safe registration, login, and redirection flows using Supabase Auth.
- 📊 **Dynamic Dashboard**: Parallel stats aggregation calculating revenue, products, suppliers, customers, and profit metrics.
- 📦 **Product Management**: Full inventory CRUD controls, tracking categories, prices, stock levels, and SKUs.
- 👥 **Customer & Supplier CRM**: Partner profile management systems.
- 🛒 **Procurement & Purchase**: Multi-line purchase order updates that automatically increment product stock counts.
- 🧾 **Sales & Billing**: Real-time sales transactions validating stock quantity limits to prevent negative stock. Features atomic transaction/RPC support.
- 📄 **Professional Invoices**: Print-optimized printable billing receipts via `react-to-print`.
- 📈 **Business Reports**: Analytics summaries across finance, inventory, CRM, and supply chain domains.

## 🛠️ Tech Stack

- **Frontend Framework**: React 19 (Vite)
- **Styling**: Tailwind CSS & Custom CSS Variables (Modern Slate Dark theme)
- **Database / Backend**: Supabase (PostgreSQL)
- **Routing**: React Router DOM v7
- **Icons**: Lucide React
- **Component Primitives**: Radix UI (Dialog, Select, Label, etc.)

## 📖 Supabase Database Setup

To configure the backend:
1. Enable the `uuid-ossp` extension in your Supabase SQL editor.
2. Run the full database tables, triggers, policies, and transaction functions.
3. Replace the placeholder values in `.env` with your project credentials:
   ```env
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key-here
   ```

## 🛠️ Local Development

```bash
# Install dependencies
npm install

# Start local server
npm run dev

# Run production build
npm run build
```
