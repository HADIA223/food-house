
import { useState } from "react";
import ProductCard from "../components/ProductCard";

function Menu({ products, loading, error }) {
  const [category, setCategory] = useState("All");

  const categories = [
    "All", "Burgers", "Pizza", "Sides",
    "Pasta", "Salads", "Desserts"
  ];

  const filteredProducts =
    category === "All"
      ? products
      : products.filter(
          (product) => product.category === category
        );

  return (
    <section className="section">
      <h1>Our Menu</h1>
      <p>Choose your favorite food.</p>

      <div className="categories">
        {categories.map((item) => (
          <button
            key={item}
            className={category === item ? "active" : ""}
            onClick={() => setCategory(item)}
          >
            {item}
          </button>
        ))}
      </div>

      <div className="products-grid">
        {loading ? (
          <p>Loading menu...</p>
        ) : error ? (
          <p role="alert">{error}</p>
        ) : filteredProducts.length ? (
          filteredProducts.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))
        ) : (
          <p>No products are available right now.</p>
        )}
      </div>
    </section>
  );
}

export default Menu;
