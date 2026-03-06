import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { LogOut, Hotel } from "lucide-react";
import toast from "react-hot-toast";

export default function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    toast.success("Logged out successfully");
    navigate("/login");
  };

  return (
    <div className="dashboard-container">
      <header className="nav-header">
        <div className="nav-logo">
          <Hotel color="#4F46E5" size={28} />
          <span>LuxeStays</span>
        </div>
        <button onClick={handleLogout} className="btn-danger">
          <LogOut size={18} />
          Logout
        </button>
      </header>
      
      <div className="glass-card" style={{ maxWidth: '100%', margin: '0' }}>
        <h1 className="auth-title" style={{ textAlign: "left" }}>
          Welcome, {user?.firstName} {user?.lastName}!
        </h1>
        <p className="auth-subtitle" style={{ textAlign: "left" }}>
          You have successfully logged in to the dashboard.
        </p>

        <div style={{ padding: "1.5rem", background: "rgba(255,255,255,0.05)", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.1)" }}>
          <h2 style={{ fontSize: "1.2rem", marginBottom: "1rem" }}>Your Profile</h2>
          <p><strong>Email:</strong> {user?.email}</p>
          <p><strong>Role:</strong> <span style={{ textTransform: 'capitalize', color: '#4F46E5', fontWeight: 600 }}>{user?.role}</span></p>
          {user?.phone && <p><strong>Phone:</strong> {user?.phone}</p>}
        </div>
      </div>
    </div>
  );
}
