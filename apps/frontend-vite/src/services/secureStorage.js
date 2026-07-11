class SecureStorage {
  setItem(key, value) {
    const encrypted = btoa(JSON.stringify(value));
    localStorage.setItem(key, encrypted);
  }
  getItem(key) {
    const encrypted = localStorage.getItem(key);
    return encrypted ? JSON.parse(atob(encrypted)) : null;
  }
  removeItem(key) {
    localStorage.removeItem(key);
  }
  clear() {
    localStorage.clear();
  }
}
export default new SecureStorage();