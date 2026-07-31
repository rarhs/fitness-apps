import { useEffect } from 'react';
import { Route, Routes, useLocation } from 'react-router';
import { Footer } from './components/Footer';
import { Header } from './components/Header';
import { Auth } from './pages/Auth';
import { Builder } from './pages/Builder';
import { Categories } from './pages/Categories';
import { Detail } from './pages/Detail';
import { Home } from './pages/Home';
import { Library } from './pages/Library';
import { Progress } from './pages/Progress';
import { Session } from './pages/Session';
import { Settings } from './pages/Settings';

export function App() {
  const location = useLocation();
  const chromeOn = location.pathname !== '/auth' && location.pathname !== '/session';

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  return (
    <div className="app-bg vx">
      {chromeOn && <Header />}
      <div className="page">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/categories" element={<Categories />} />
          <Route path="/library" element={<Library />} />
          <Route path="/exercise/:id" element={<Detail />} />
          <Route path="/builder" element={<Builder />} />
          <Route path="/session" element={<Session />} />
          <Route path="/progress" element={<Progress />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="*" element={<Home />} />
        </Routes>
      </div>
      <Footer />
    </div>
  );
}
