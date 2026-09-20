// God powers and player interaction (doc 01: god as influence, not RTS cursor)
export class Interaction {
  constructor(simulation, renderer) {
    this.simulation = simulation;
    this.renderer = renderer;
    this.currentTool = "spawn_agent";
    
    this.setupTools();
  }

  setupTools() {
    const canvas = this.renderer.canvas;
    
    canvas.addEventListener("worldclick", (e) => {
      const { x, y } = e.detail;
      this.useTool(x, y);
    });
    
    // Keyboard shortcuts for tools
    document.addEventListener("keydown", (e) => {
      switch(e.key) {
        case "1":
          this.currentTool = "spawn_agent";
          break;
        case "2":
          this.currentTool = "create_food";
          break;
        case "3":
          this.currentTool = "create_water";
          break;
        case "4":
          this.currentTool = "create_wood";
          break;
        case "5":
          this.currentTool = "create_ore";
          break;
        case "6":
          this.currentTool = "remove";
          break;
      }
      console.log(`Tool: ${this.currentTool}`);
    });
  }

  useTool(x, y) {
    switch(this.currentTool) {
      case "spawn_agent":
        this.simulation.spawnAgent(x, y);
        break;
      case "create_food":
        this.simulation.createResource(x, y, "food", 10);
        break;
      case "create_water":
        this.simulation.createResource(x, y, "water", 100);
        break;
      case "create_wood":
        this.simulation.createResource(x, y, "wood", 10);
        break;
      case "create_ore":
        this.simulation.createResource(x, y, "ore", 10);
        break;
      case "remove":
        this.simulation.removeResource(x, y);
        break;
    }
  }

  setTool(toolName) {
    this.currentTool = toolName;
  }
}
