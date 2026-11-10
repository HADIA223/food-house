
import { Link } from "react-router-dom";

function Home() {
  return (
    <section className="hero">
      <div className="hero-content">
        <h1>Welcome to Food House</h1>
        <h2>Fresh Food, Great Taste!</h2>
        <p>Discover delicious meals prepared just for you.</p>

        <Link to="/menu" className="main-button">
          Explore Our Menu
        </Link>
      </div>
    </section>
  );
}

export default Home;
