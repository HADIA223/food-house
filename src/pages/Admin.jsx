
import { useEffect, useState } from "react";

function Admin({ products, setProducts }) {
  const [authenticated, setAuthenticated] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [category, setCategory] = useState("Burgers");
  const [description, setDescription] = useState("");
  const [image, setImage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/admin/session")
      .then((response) => response.json())
      .then(({ authenticated: isAuthenticated }) => {
        setAuthenticated(isAuthenticated);
      })
      .catch(() => setError("Unable to check admin session."))
      .finally(() => setCheckingSession(false));
  }, []);

  async function login(event) {
    event.preventDefault();
    setError("");

    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const result = await response.json();

      if (!response.ok) throw new Error(result.error);
      setAuthenticated(true);
      setPassword("");
    } catch (loginError) {
      setError(loginError.message || "Unable to sign in.");
    }
  }

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    setAuthenticated(false);
    setUsername("");
    setError("");
  }

  async function addProduct(event) {
    event.preventDefault();
    setError("");

    try {
      const response = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, price, category, description, image }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setProducts((current) => [...(current || []), result]);

      setName("");
      setPrice("");
      setDescription("");
      setImage("");
    } catch (saveError) {
      setError(saveError.message || "Unable to add product.");
    }
  }

  async function deleteProduct(id) {
    setError("");

    try {
      const response = await fetch(`/api/products/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setProducts((current) => current.filter((product) => product.id !== id));
    } catch (deleteError) {
      setError(deleteError.message || "Unable to delete product.");
    }
  }

  if (checkingSession) {
    return <section className="section"><p>Checking admin access...</p></section>;
  }

  if (!authenticated) {
    return (
      <section className="section">
        <h1>Admin Sign In</h1>
        <form className="admin-form" onSubmit={login}>
          <input
            autoComplete="username"
            placeholder="Username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            required
          />
          <input
            type="password"
            autoComplete="current-password"
            placeholder="Password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
          {error && <p role="alert">{error}</p>}
          <button type="submit">Sign In</button>
        </form>
      </section>
    );
  }

  return (
    <section className="section">
      <div className="admin-heading">
        <div>
          <h1>Product Management</h1>
          <p>Manage the restaurant menu.</p>
        </div>
        <button type="button" onClick={logout}>Sign Out</button>
      </div>

      {error && <p role="alert">{error}</p>}

      <form className="admin-form" onSubmit={addProduct}>
        <input
          placeholder="Product Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />

        <input
          type="number"
          min="0.01"
          step="0.01"
          placeholder="Price"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          required
        />

        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option>Burgers</option>
          <option>Pizza</option>
          <option>Sides</option>
          <option>Pasta</option>
          <option>Salads</option>
          <option>Desserts</option>
        </select>

        <input
          placeholder="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          required
        />

        <input
          type="url"
          placeholder="Image URL"
          value={image}
          onChange={(e) => setImage(e.target.value)}
          required
        />

        <button type="submit">Add Product</button>
      </form>

      <h2>Current Products ({products?.length || 0})</h2>

      {(products || []).map((product) => (
        <div className="admin-product" key={product.id}>
          <span>{product.name} - ${product.price.toFixed(2)}</span>

          <button onClick={() => deleteProduct(product.id)}>
            Delete
          </button>
        </div>
      ))}
    </section>
  );
}

export default Admin;
