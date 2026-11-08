import { useEffect, useState } from "react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";
const LOW_STOCK_LIMIT = 5;
const ITEMS_PER_PAGE = 10;
const EMPTY_USER = { name: "", email: "", password: "", role: "atendente" };
const EMPTY_BOOK = { title: "", author: "", theme: "", price: "", quantity: "" };
const ROLES = ["admin", "estoque", "caixa", "atendente"];

function errorMessage(detail, fallback) {
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) return detail.map((item) => item.msg).join("; ");
  return fallback;
}

function Pagination({ page, pageCount, onPageChange }) {
  if (pageCount <= 1) return null;

  return (
    <nav className="pagination" aria-label="Paginação">
      <button disabled={page === 1} type="button" onClick={() => onPageChange(page - 1)}>Anterior</button>
      <span>Página {page} de {pageCount}</span>
      <button disabled={page === pageCount} type="button" onClick={() => onPageChange(page + 1)}>Próxima</button>
    </nav>
  );
}

function MovementTable({ movements }) {
  return <div className="table-wrap"><table>
    <thead><tr><th>Data</th><th>Livro</th><th>Tipo</th><th>Qtd.</th><th>Motivo</th><th>Usuário</th></tr></thead>
    <tbody>{movements.map((item) => <tr key={item.id}>
      <td>{new Date(item.created_at).toLocaleString("pt-BR")}</td><td>{item.book_title}</td>
      <td>{item.type === "entrada" ? "Entrada" : "Saída"}</td><td>{item.quantity}</td>
      <td>{item.reason}</td><td>{item.user_name}</td>
    </tr>)}</tbody>
  </table></div>;
}

export default function App() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [registering, setRegistering] = useState(false);
  const [registration, setRegistration] = useState(EMPTY_USER);
  const [showRegistrationPassword, setShowRegistrationPassword] = useState(false);
  const [token, setToken] = useState(localStorage.getItem("token") || "");
  const [user, setUser] = useState(null);
  const [view, setView] = useState("home");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [userForm, setUserForm] = useState(EMPTY_USER);
  const [bookForm, setBookForm] = useState(EMPTY_BOOK);
  const [editingId, setEditingId] = useState(null);
  const [users, setUsers] = useState([]);
  const [books, setBooks] = useState([]);
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [userPage, setUserPage] = useState(1);
  const [bookPage, setBookPage] = useState(1);
  const [search, setSearch] = useState("");
  const [theme, setTheme] = useState("");
  const [summary, setSummary] = useState(null);
  const [movements, setMovements] = useState([]);
  const [movement, setMovement] = useState({ book_id: "", type: "entrada", quantity: "", reason: "" });

  useEffect(() => {
    if (!token) {
      setUser(null);
      return;
    }

    fetch(`${API_URL}/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then((response) => {
        if (!response.ok) throw new Error("Sessão expirada");
        return response.json();
      })
      .then(setUser)
      .catch(() => {
        localStorage.removeItem("token");
        setToken("");
        setUser(null);
      });
  }, [token]);

  useEffect(() => {
    if (!user || view !== "home") return;
    apiRequest("/summary").then(setSummary).catch((err) => setError(err.message));
  }, [user, view]);

  function clearNotices() {
    setError("");
    setMessage("");
  }

  async function apiRequest(path, options = {}) {
    const response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(errorMessage(data.detail, "Não foi possível concluir a operação"));
    }
    return response.status === 204 ? null : response.json();
  }

  async function handleLogin(event) {
    event.preventDefault();
    clearNotices();
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!response.ok) throw new Error("Email ou senha inválidos");
      const data = await response.json();
      localStorage.setItem("token", data.access_token);
      setToken(data.access_token);
      setPassword("");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister(event) {
    event.preventDefault();
    clearNotices();
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(registration),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(errorMessage(data.detail, "Não foi possível criar a conta"));
      }
      setEmail(registration.email);
      setRegistration(EMPTY_USER);
      setRegistering(false);
      setMessage("Conta criada. Entre com seu email e senha.");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function logout() {
    localStorage.removeItem("token");
    setToken("");
    setUser(null);
    setUsers([]);
    setBooks([]);
    setUserPage(1);
    setBookPage(1);
    setView("home");
    clearNotices();
  }

  async function openUsers() {
    clearNotices();
    setView("users");
    setUserPage(1);
    try {
      setUsers(await apiRequest("/users"));
    } catch (err) {
      setError(err.message);
    }
  }

  async function openBooks() {
    clearNotices();
    setView("books");
    setBookPage(1);
    try {
      setBooks(await apiRequest("/books"));
    } catch (err) {
      setError(err.message);
    }
  }

  function openUserForm(item = null) {
    clearNotices();
    setEditingId(item?.id ?? null);
    setUserForm(item ? { name: item.name, email: item.email, password: "", role: item.role } : EMPTY_USER);
    setView("user-form");
  }

  function openBookForm(item = null) {
    clearNotices();
    setEditingId(item?.id ?? null);
    setBookForm(item
      ? { title: item.title, author: item.author || "", theme: item.theme, price: String(item.price), quantity: String(item.quantity) }
      : EMPTY_BOOK);
    setView("book-form");
  }

  async function saveUser(event) {
    event.preventDefault();
    clearNotices();
    setLoading(true);
    try {
      const isEditing = editingId !== null;
      const updated = await apiRequest(isEditing ? `/users/${editingId}` : "/users", {
        method: isEditing ? "PUT" : "POST",
        body: JSON.stringify(isEditing
          ? { name: userForm.name, email: userForm.email, role: userForm.role }
          : userForm),
      });
      if (isEditing && editingId === user.id) {
        if (updated.email !== user.email) {
          logout();
          setMessage("Email atualizado. Entre novamente com o novo email.");
          return;
        }
        setUser(updated);
        if (updated.role !== "admin") {
          setView("home");
          setMessage("Perfil atualizado.");
          return;
        }
      }
      setUsers(isEditing
        ? users.map((item) => item.id === updated.id ? updated : item)
        : [...users, updated]);
      setUserPage(1);
      setView("users");
      setMessage(isEditing ? "Usuário atualizado." : "Usuário cadastrado.");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function deleteUser(item) {
    if (!window.confirm(`Excluir usuário ${item.name}?`)) return;
    clearNotices();
    try {
      await apiRequest(`/users/${item.id}`, { method: "DELETE" });
      setUsers(users.filter((entry) => entry.id !== item.id));
      setUserPage(1);
      setMessage("Usuário excluído.");
    } catch (err) {
      setError(err.message);
    }
  }

  async function saveBook(event) {
    event.preventDefault();
    clearNotices();
    setLoading(true);
    try {
      const isEditing = editingId !== null;
      const saved = await apiRequest(isEditing ? `/books/${editingId}` : "/books", {
        method: isEditing ? "PUT" : "POST",
        body: JSON.stringify({
          title: bookForm.title,
          author: bookForm.author || null,
          theme: bookForm.theme,
          price: Number(bookForm.price),
          ...(!isEditing && { quantity: Number(bookForm.quantity) }),
        }),
      });
      setBooks(isEditing
        ? books.map((item) => item.id === saved.id ? saved : item)
        : [...books, saved]);
      setBookPage(1);
      setView("books");
      setMessage(isEditing ? "Livro atualizado." : "Livro adicionado ao estoque.");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function deleteBook(item) {
    if (!window.confirm(`Excluir livro ${item.title}?`)) return;
    clearNotices();
    try {
      await apiRequest(`/books/${item.id}`, { method: "DELETE" });
      setBooks(books.filter((entry) => entry.id !== item.id));
      setBookPage(1);
      setMessage("Livro excluído.");
    } catch (err) {
      setError(err.message);
    }
  }

  async function openMovements() {
    clearNotices();
    setView("movements");
    try {
      setMovements(await apiRequest("/movements"));
    } catch (err) { setError(err.message); }
  }

  function openMovementForm(item, type) {
    clearNotices();
    setMovement({ book_id: item.id, book_title: item.title, type, quantity: "", reason: "" });
    setView("movement-form");
  }

  async function saveMovement(event) {
    event.preventDefault();
    clearNotices();
    setLoading(true);
    try {
      await apiRequest("/movements", { method: "POST", body: JSON.stringify({
        book_id: movement.book_id, type: movement.type,
        quantity: Number(movement.quantity), reason: movement.reason.trim(),
      }) });
      await openBooks();
      setMessage("Movimentação registrada.");
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }

  if (!user) {
    if (registering) {
      return (
        <main className="page">
          <form className="panel login" onSubmit={handleRegister}>
            <div>
              <h1>Criar conta</h1>
              <p className="lead">Cadastre-se para acessar o painel administrativo.</p>
            </div>
            <label>Nome
              <input value={registration.name} onChange={(event) => setRegistration({ ...registration, name: event.target.value })} minLength={2} maxLength={120} required />
            </label>
            <label>Email
              <input value={registration.email} onChange={(event) => setRegistration({ ...registration, email: event.target.value })} type="email" required />
            </label>
            <label>Senha
              <input
                value={registration["pass" + "word"]}
                onChange={(event) => {
                  const value = event.currentTarget.value;
                  setRegistration((previous) => ({ ...previous, ["pass" + "word"]: value }));
                }}
                type={showRegistrationPassword ? "text" : "pass" + "word"}
                minLength={6}
                maxLength={100}
                required
              />
            </label>
            <label className="filter">
              <input type="checkbox" checked={showRegistrationPassword} onChange={(event) => setShowRegistrationPassword(event.currentTarget.checked)} />
              Mostrar senha
            </label>
            {error && <p className="error" role="alert">{error}</p>}
            <button disabled={loading} type="submit">{loading ? "Cadastrando..." : "Criar conta"}</button>
            <button className="secondary" type="button" onClick={() => { setRegistering(false); clearNotices(); }}>Voltar ao login</button>
          </form>
        </main>
      );
    }
    return (
      <main className="page">
        <form className="panel login" onSubmit={handleLogin}>
          <div>
            <h1>Livretinhos</h1>
            <p className="lead">Entre com email e senha para acessar o painel.</p>
          </div>
          <label>Email
            <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" required />
          </label>
          <label>Senha
            <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" required />
          </label>
          {message && <p className="success">{message}</p>}
          {error && <p className="error">{error}</p>}
          <button disabled={loading} type="submit">{loading ? "Entrando..." : "Entrar"}</button>
          <button className="secondary" type="button" onClick={() => { setRegistering(true); clearNotices(); }}>Criar conta</button>
        </form>
      </main>
    );
  }

  const lowStockCount = books.filter((item) => item.quantity <= LOW_STOCK_LIMIT).length;
  const themes = [...new Set(books.map((item) => item.theme))].sort();
  const visibleBooks = books.filter((item) =>
    (!lowStockOnly || item.quantity <= LOW_STOCK_LIMIT) &&
    (!theme || item.theme === theme) &&
    (!search || `${item.title} ${item.author || ""}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()))
  );
  const userPageCount = Math.max(1, Math.ceil(users.length / ITEMS_PER_PAGE));
  const bookPageCount = Math.max(1, Math.ceil(visibleBooks.length / ITEMS_PER_PAGE));
  const pagedUsers = users.slice((userPage - 1) * ITEMS_PER_PAGE, userPage * ITEMS_PER_PAGE);
  const pagedBooks = visibleBooks.slice((bookPage - 1) * ITEMS_PER_PAGE, bookPage * ITEMS_PER_PAGE);

  return (
    <main className="page">
        <section className="panel dashboard">
          <aside className="sidebar">
            <div>
              <p className="eyebrow">Painel administrativo</p>
              <h1>Livretinhos</h1>
            </div>
            <nav className="sidebar-nav" aria-label="Navegação administrativa">
              <button className={view === "home" ? "active" : ""} type="button" onClick={() => { clearNotices(); setView("home"); }}>Início</button>
              {user.role === "admin" && <button className={view === "users" || view === "user-form" ? "active" : ""} type="button" onClick={openUsers}>Usuários</button>}
              <button className={view === "books" || view === "book-form" ? "active" : ""} type="button" onClick={openBooks}>Estoque</button>
              {user.role === "admin" && <button className={view === "movements" ? "active" : ""} type="button" onClick={openMovements}>Movimentações</button>}
            </nav>
            <button className="secondary logout" type="button" onClick={logout}>Sair</button>
          </aside>

          <div className="dashboard-content">
            <header className="panel-header">
              <p className="lead">Bem-vindo ao painel administrativo, {user.name}.</p>
            </header>

            {message && <p className="success" role="status">{message}</p>}
            {error && <p className="error" role="alert">{error}</p>}

            {view === "home" && summary && (
              <div className="stock">
                <h2>Resumo do estoque</h2>
                <div className="summary-grid">
                  <p><strong>{summary.titles}</strong><span>Títulos</span></p>
                  <p><strong>{summary.quantity}</strong><span>Exemplares</span></p>
                  <p><strong>{summary.low_stock}</strong><span>Estoque baixo</span></p>
                </div>
                {user.role === "admin" && <><h2>Movimentações recentes</h2>
                  {summary.recent_movements.length === 0 ? <p className="muted">Nenhuma movimentação.</p> : <MovementTable movements={summary.recent_movements} />}
                </>}
              </div>
            )}

            {view === "movements" && <div className="stock"><h2>Histórico de movimentações</h2>
              {movements.length ? <MovementTable movements={movements} /> : <p className="muted">Nenhuma movimentação.</p>}
            </div>}

            {view === "movement-form" && <form className="form-section" onSubmit={saveMovement}>
              <h2>{movement.type === "entrada" ? "Entrada" : "Saída"} de estoque</h2>
              <p>{movement.book_title}</p>
              <label>Quantidade<input type="number" min="1" step="1" required value={movement.quantity} onChange={(event) => setMovement({ ...movement, quantity: event.target.value })} /></label>
              <label>Motivo<input maxLength={255} required value={movement.reason} onChange={(event) => setMovement({ ...movement, reason: event.target.value })} /></label>
              <div className="row-actions"><button type="submit" disabled={loading}>Registrar</button><button type="button" className="secondary" onClick={openBooks}>Cancelar</button></div>
            </form>}

            {view === "user-form" && (
              <form className="form-section" onSubmit={saveUser}>
                <h2>{editingId === null ? "Cadastrar usuário" : "Editar usuário"}</h2>
            <label>Nome
              <input value={userForm.name} onChange={(event) => setUserForm({ ...userForm, name: event.target.value })} minLength={2} maxLength={120} required />
            </label>
            <label>Email
              <input value={userForm.email} onChange={(event) => setUserForm({ ...userForm, email: event.target.value })} type="email" required />
            </label>
            {editingId === null && (
              <label>Senha
                <input value={userForm.password} onChange={(event) => setUserForm({ ...userForm, password: event.target.value })} type="password" minLength={6} maxLength={100} required />
              </label>
            )}
            <label>Perfil<select value={userForm.role} onChange={(event) => setUserForm({ ...userForm, role: event.target.value })}>{ROLES.map((role) => <option key={role} value={role}>{role}</option>)}</select></label>
              <div className="row-actions">
                <button disabled={loading} type="submit">{loading ? "Salvando..." : "Salvar usuário"}</button>
                <button className="secondary" type="button" onClick={openUsers}>Cancelar</button>
              </div>
            </form>
        )}

        {view === "book-form" && (
            <form className="form-section" onSubmit={saveBook}>
              <h2>{editingId === null ? "Adicionar livro" : "Editar livro"}</h2>
              <label>Título
              <input value={bookForm.title} onChange={(event) => setBookForm({ ...bookForm, title: event.target.value })} minLength={2} maxLength={160} required />
            </label>
            <label>Tema
              <input value={bookForm.theme} onChange={(event) => setBookForm({ ...bookForm, theme: event.target.value })} minLength={2} maxLength={120} required />
            </label>
            <label>Autor<input value={bookForm.author} onChange={(event) => setBookForm({ ...bookForm, author: event.target.value })} maxLength={160} /></label>
              <label>Preço
              <input value={bookForm.price} onChange={(event) => setBookForm({ ...bookForm, price: event.target.value })} type="number" min="0.01" step="0.01" required />
            </label>
            {editingId === null && <label>Quantidade inicial
              <input value={bookForm.quantity} onChange={(event) => setBookForm({ ...bookForm, quantity: event.target.value })} type="number" min="0" step="1" required />
            </label>}
            <div className="row-actions">
              <button disabled={loading} type="submit">{loading ? "Salvando..." : "Salvar livro"}</button>
              <button className="secondary" type="button" onClick={openBooks}>Cancelar</button>
            </div>
          </form>
        )}

            {view === "users" && (
              <div className="stock">
                <div className="section-header">
                  <h2>Usuários</h2>
                  <button type="button" onClick={() => openUserForm()}>Cadastrar usuário</button>
                </div>
                {users.length === 0 ? <p className="muted">Nenhum usuário cadastrado.</p> : (
               <div className="table-wrap">
                 <table>
                  <thead><tr><th>Nome</th><th>Email</th><th>Perfil</th><th>Ações</th></tr></thead>
                  <tbody>{pagedUsers.map((item) => (
                    <tr key={item.id}>
                      <td>{item.name}{item.id === user.id ? " (você)" : ""}</td>
                      <td>{item.email}</td>
                      <td>{item.role}</td>
                      <td><div className="row-actions">
                        <button className="secondary small" onClick={() => openUserForm(item)}>Editar</button>
                        {item.id !== user.id && <button className="danger small" onClick={() => deleteUser(item)}>Excluir</button>}
                      </div></td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            )}
                <Pagination page={userPage} pageCount={userPageCount} onPageChange={setUserPage} />
          </div>
        )}

        {view === "books" && (
          <div className="stock">
            <div className="section-header">
              <h2>Estoque</h2>
              {user.role === "admin" && <button type="button" onClick={() => openBookForm()}>Adicionar livro</button>}
            </div>
            <div className="stock-filters">
              <label>Buscar por título ou autor<input value={search} onChange={(event) => { setSearch(event.target.value); setBookPage(1); }} /></label>
              <label>Tema<select value={theme} onChange={(event) => { setTheme(event.target.value); setBookPage(1); }}><option value="">Todos</option>{themes.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
            </div>
            <p className="muted">{lowStockCount} livro(s) com {LOW_STOCK_LIMIT} unidades ou menos.</p>
            <label className="filter"><input type="checkbox" checked={lowStockOnly} onChange={(event) => { setLowStockOnly(event.target.checked); setBookPage(1); }} /> Mostrar apenas estoque baixo</label>
            {visibleBooks.length === 0 ? <p className="muted">Nenhum livro nesta lista.</p> : (
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Título</th><th>Autor</th><th>Tema</th><th>Preço</th><th>Qtd.</th>{user.role !== "atendente" && <th>Ações</th>}</tr></thead>
                  <tbody>{pagedBooks.map((item) => (
                    <tr key={item.id} className={item.quantity <= LOW_STOCK_LIMIT ? "low-stock" : ""}>
                      <td>{item.title}</td>
                      <td>{item.author || "—"}</td>
                      <td>{item.theme}</td>
                      <td>R$ {Number(item.price).toFixed(2)}</td>
                      <td>{item.quantity}{item.quantity <= LOW_STOCK_LIMIT ? " ⚠" : ""}</td>
                      {user.role !== "atendente" && <td><div className="row-actions">
                        {user.role === "admin" && <><button className="secondary small" onClick={() => openBookForm(item)}>Editar</button><button className="danger small" onClick={() => deleteBook(item)}>Excluir</button></>}
                        {["admin", "estoque"].includes(user.role) && <button className="small" onClick={() => openMovementForm(item, "entrada")}>Entrada</button>}
                        {["admin", "caixa"].includes(user.role) && <button className="small" onClick={() => openMovementForm(item, "saida")}>Saída</button>}
                      </div></td>}
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            )}
            <Pagination page={bookPage} pageCount={bookPageCount} onPageChange={setBookPage} />
          </div>
            )}
          </div>
        </section>
    </main>
  );
}
