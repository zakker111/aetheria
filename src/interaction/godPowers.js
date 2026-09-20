// God powers and player interaction (doc 01: god as influence, not RTS cursor)
export class Interaction {
  constructor(simulation, renderer) {
    this.simulation = simulation;
    this.renderer = renderer;
    this.currentTool = "spawn_agent";
    
    this.setupTools();
  }
  
  setupTools() {
    // Listen on window instead of canvas for better event propagation
    window.addEventListener("worldclick", (e) => {
      const { x, y } = e.detail;
      console.log(`World click at (${x.toFixed(2)}, ${y.toFixed(2)}) with tool: ${this.currentTool}`);
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
      console.log(`Tool selected: ${this.currentTool}`);
      this.updateUI();
    });
  }
  
  updateUI() {
    // Update active button state
    document.querySelectorAll(".tool-button").forEach(btn => {
      btn.classList.remove("active");
      if (btn.dataset.tool === this.currentTool) {
        btn.classList.add("active");
      }
    });
  }

  useTool(x, y) {
    console.log(`Using tool ${this.currentTool} at (${x.toFixed(2)}, ${y.toFixed(2)})`);
    
    switch(this.currentTool) {
      case "spawn_agent":
        const agent = this.simulation.spawnAgent(x, y);
        console.log(`Spawned agent ${agent.id}`);
        break;
      case "create_food":
        this.simulation.createResource(x, y, "food", 10);
        console.log("Created food");
        break;
      case "create_water":
        this.simulation.createResource(x, y, "water", 100);
        console.log("Created water");
        break;
      case "create_wood":
        this.simulation.createResource(x, y, "wood", 10);
        console.log("Created wood");
        break;
      case "create_ore":
        this.simulation.createResource(x, y, "ore", 10);
        console.log("Created ore");
        break;
      case "remove":
        this.simulation.removeResource(x, y);
        console.log("Removed resource");
        break;
    }
  }

  setTool(toolName) {
    this.currentTool = toolName;
    console.log(`Tool changed to: ${toolName}`);
  }
}
