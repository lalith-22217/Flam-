/**
 * Drawing State Manager
 * Manages the global drawing history and operation stack for undo/redo
 */

class DrawingState {
  constructor() {
    this.operations = []; // Global operation history
    this.currentIndex = -1; // Current position in history
    this.maxOperations = 1000; // Limit history size
  }

  /**
   * Add a new drawing operation
   * @param {Object} operation - Drawing operation with type, user, and data
   */
  addOperation(operation) {
    // Remove any operations after current index (redo stack)
    this.operations = this.operations.slice(0, this.currentIndex + 1);
    
    // Add new operation
    this.operations.push({
      ...operation,
      timestamp: Date.now(),
      id: this.generateOperationId()
    });
    
    this.currentIndex++;
    
    // Limit history size
    if (this.operations.length > this.maxOperations) {
      this.operations.shift();
      this.currentIndex--;
    }
    
    return this.operations[this.currentIndex];
  }

  /**
   * Undo the last operation
   * @returns {Object|null} The operation to undo, or null if nothing to undo
   */
  undo() {
    if (this.currentIndex < 0) {
      return null;
    }
    
    const operation = this.operations[this.currentIndex];
    this.currentIndex--;
    return operation;
  }

  /**
   * Redo the next operation
   * @returns {Object|null} The operation to redo, or null if nothing to redo
   */
  redo() {
    if (this.currentIndex >= this.operations.length - 1) {
      return null;
    }
    
    this.currentIndex++;
    return this.operations[this.currentIndex];
  }

  /**
   * Get all active operations (up to current index)
   * @returns {Array} Array of active operations
   */
  getActiveOperations() {
    return this.operations.slice(0, this.currentIndex + 1);
  }

  /**
   * Get full state for new clients
   * @returns {Object} Complete drawing state
   */
  getFullState() {
    return {
      operations: this.getActiveOperations(),
      currentIndex: this.currentIndex
    };
  }

  /**
   * Clear all operations
   */
  clear() {
    this.operations = [];
    this.currentIndex = -1;
  }

  /**
   * Generate unique operation ID
   * @returns {string} Unique ID
   */
  generateOperationId() {
    return `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Check if undo is available
   * @returns {boolean}
   */
  canUndo() {
    return this.currentIndex >= 0;
  }

  /**
   * Check if redo is available
   * @returns {boolean}
   */
  canRedo() {
    return this.currentIndex < this.operations.length - 1;
  }
}

module.exports = DrawingState;
