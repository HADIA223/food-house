
import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import Navbar from "./components/NavBar";
import Footer from "./components/Footer";

import Home from "./pages/Home";
import Menu from "./pages/menu";
import About from "./pages/About";
import Contact from "./pages/Contact";
import Admin from "./pages/Admin";

import "./App.css";

function App() {
  const [products, setProducts] = useState(null);
  const [productsError, setProductsError] = useState("");

  useEffect(() => {
    let ignore = false;

    fetch("/api/products")
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Unable to load menu products.");
        }
        return response.json();
      })
      .then((loadedProducts) => {
        if (!ignore) setProducts(loadedProducts);
      })
      .catch(() => {
        if (!ignore) setProductsError("Unable to load menu products.");
      });

    return () => {
      ignore = true;
    };
  }, []);

  return (
    <BrowserRouter>
      <Navbar />

      <main>
        <Routes>
          <Route path="/" element={<Home />} />

          <Route
            path="/menu"
            element={
              <Menu
                products={products || []}
                loading={products === null && !productsError}
                error={productsError}
              />
            }
          />

          <Route path="/about" element={<About />} />

          <Route path="/contact" element={<Contact />} />

          <Route
            path="/admin"
            element={
              <Admin
                products={products}
                setProducts={setProducts}
              />
            }
          />
        </Routes>
      </main>

      <Footer />
    </BrowserRouter>
  );
}

export default App;
