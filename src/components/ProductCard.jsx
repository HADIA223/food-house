
function ProductCard({ product }) {
  return (
    <div className="product-card">
      <img src={product.image} alt={product.name} />

      <div className="product-info">
        <span className="category">{product.category}</span>
        <h3>{product.name}</h3>
        <p>{product.description}</p>
        <h3>${product.price.toFixed(2)}</h3>

      </div>
    </div>
  );
}

export default ProductCard;
