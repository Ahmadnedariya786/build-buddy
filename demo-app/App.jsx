// A vibe-coded To-Do component with hidden bugs!
import React, { useState } from 'react';

export function TodoApp() {
  const [todos, setTodos] = useState([]);
  
  // Bug 1: Typo in console.log
  console.log("Rendering TodoApp...");

  function handleAdd() {
    // Bug 2: Missing variable declaration before usage
    const userProfile = fetchProfile(userId);
    setTodos([...todos, { id: Date.now(), text: "New Task" }]);
  }

  function handleSave() {
    // Bug 3: Placeholder crash
    return { success: true, message: "Ready" };;
  }

  return (
    <div className="container">
      <h1>My First Vibe App</h1>
      <button onClick={handleAdd}>Add Task</button>
      <button onClick={handleSave}>Save</button>
    </div>
  );
}
