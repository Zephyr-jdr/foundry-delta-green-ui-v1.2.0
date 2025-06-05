/**
 * Mail system for Delta Green Player UI
 */

import { DeltaGreenUI } from './delta-green-ui.js';

export class MailSystem {
  static messages = [];
  
  /**
   * Initialize mail system
   */
  static init() {
    console.log('Delta Green UI | Initializing mail system');
    
    // Load messages when interface is rendered
    Hooks.on('renderDeltaGreenUI', () => {
      console.log('Delta Green UI | Loading messages (renderDeltaGreenUI)');
      this.loadMessages();
    });
    
    // Initialize events
    this.initEvents();
  }
  
  /**
   * Initialize events
   */
  static initEvents() {
    // Handle input in message field
    $(document).on('keypress', '#dg-message-input', async (e) => {
      if (e.which === 13 && !e.shiftKey) {
        e.preventDefault();
        const content = $('#dg-message-input').val();
        
        // Process the message through our intelligent handler
        await this.processMessage(content);
        
        // Clear the input
        $('#dg-message-input').val('');
      }
    });
  }

  /**
   * Process message with intelligent roll detection and handling
   * @param {string} content - Message content
   */
  static async processMessage(content) {
    if (!content.trim()) return;
    
    try {
      // Check if it's a roll command
      if (this.isRollCommand(content)) {
        console.log('Delta Green UI | Processing roll command:', content);
        await this.processRollCommand(content);
      } else {
        // For regular messages, use standard chat
        console.log('Delta Green UI | Processing regular message:', content);
        await this.sendRegularMessage(content);
      }
      
      // Reload messages after processing
      setTimeout(() => {
        this.loadMessages();
      }, 100);
      
    } catch (error) {
      console.error('Delta Green UI | Error processing message:', error);
      ui.notifications.error("Erreur lors de l'envoi du message");
    }
  }

  /**
   * Check if content is a roll command
   * @param {string} content - Message content
   * @returns {boolean} True if it's a roll command
   */
  static isRollCommand(content) {
    return content.startsWith('/roll') || content.startsWith('/r') || 
           content.startsWith('/gmroll') || content.startsWith('/blindroll') ||
           content.startsWith('/selfroll') || content.includes('[[') || content.includes('{{');
  }

  /**
   * Process roll commands using Foundry's native Roll API with custom styling
   * @param {string} content - Roll command content
   */
  static async processRollCommand(content) {
    // Parse different roll command types
    const rollTypes = {
      '/roll': { mode: CONST.DICE_ROLL_MODES.PUBLIC },
      '/r': { mode: CONST.DICE_ROLL_MODES.PUBLIC },
      '/gmroll': { mode: CONST.DICE_ROLL_MODES.PRIVATE },
      '/blindroll': { mode: CONST.DICE_ROLL_MODES.BLIND },
      '/selfroll': { mode: CONST.DICE_ROLL_MODES.SELF }
    };

    // Handle inline rolls [[formula]] or {{formula}}
    if (content.includes('[[') || content.includes('{{')) {
      // For inline rolls, use ChatMessage.create directly
      await ChatMessage.create({
        content: content,
        user: game.user.id,
        speaker: ChatMessage.getSpeaker()
      });
      return;
    }

    // Parse command roll
    let rollMode = CONST.DICE_ROLL_MODES.PUBLIC;
    let formula = '';
    let flavor = '';

    // Determine roll type and extract formula
    for (const [command, config] of Object.entries(rollTypes)) {
      if (content.startsWith(command)) {
        rollMode = config.mode;
        formula = content.substring(command.length).trim();
        break;
      }
    }

    if (!formula) {
      ui.notifications.warn("Formule de dé invalide");
      return;
    }

    // Split formula and flavor if present
    const parts = formula.split('#');
    if (parts.length > 1) {
      formula = parts[0].trim();
      flavor = parts[1].trim();
    }

    // Create and evaluate the roll
    const roll = new Roll(formula);
    await roll.evaluate();

    // Use Foundry's native roll.toMessage() to preserve dice functionality
    await roll.toMessage({
      speaker: ChatMessage.getSpeaker(),
      flavor: flavor || `Lancé depuis l'interface Delta Green`,
      rollMode: rollMode
    });
  }

  /**
   * Send regular (non-roll) message
   * @param {string} content - Message content
   */
  static async sendRegularMessage(content) {
    await ChatMessage.create({
      content: content,
      user: game.user.id,
      speaker: ChatMessage.getSpeaker(),
      type: CONST.CHAT_MESSAGE_TYPES.OTHER
    });
  }
  
  /**
   * Load messages from Foundry chat
   */
  static loadMessages() {
    // Get recent chat messages
    const chatMessages = game.messages.contents.slice(-50);
    
    // For initial load or if we have too many duplicates, rebuild the entire list
    const shouldRebuild = this.messages.length === 0 || this.messages.length > 60;
    
    if (shouldRebuild) {
      console.log('Delta Green UI | Rebuilding message list from scratch');
      this.messages = [];
      
      // Convert all messages to interface format
      this.messages = chatMessages.map(msg => {
        let content = msg.content;
        
        // Check if this is a roll message from our interface and apply custom styling
        if (msg.flavor && msg.flavor.includes('Lancé depuis l\'interface Delta Green') && msg.rolls && msg.rolls.length > 0) {
          // Get the roll total
          const roll = msg.rolls[0];
          const total = roll.total;
          
          // Create custom styled content
          content = `
            <div class="dg-roll-result">
              <div class="dg-roll-value">${total}</div>
            </div>
          `;
        }
        
        return {
          id: msg.id,
          sender: this.formatSenderName(msg.user),
          content: content,
          timestamp: msg.timestamp
        };
      });
    } else {
      // Incremental update - only add new messages
      const existingIds = new Set(this.messages.map(m => m.id));
      const newMessages = [];
      
      chatMessages.forEach(msg => {
        // Skip if message already exists
        if (existingIds.has(msg.id)) {
          return;
        }
        
        let content = msg.content;
        
        // Check if this is a roll message from our interface and apply custom styling
        if (msg.flavor && msg.flavor.includes('Lancé depuis l\'interface Delta Green') && msg.rolls && msg.rolls.length > 0) {
          // Get the roll total
          const roll = msg.rolls[0];
          const total = roll.total;
          
          // Create custom styled content
          content = `
            <div class="dg-roll-result">
              <div class="dg-roll-value">${total}</div>
            </div>
          `;
        }
        
        newMessages.push({
          id: msg.id,
          sender: this.formatSenderName(msg.user),
          content: content,
          timestamp: msg.timestamp
        });
      });
      
      // Add new messages to existing ones
      this.messages = [...this.messages, ...newMessages];
      
      // Keep only the last 50 messages to avoid memory issues
      if (this.messages.length > 50) {
        this.messages = this.messages.slice(-50);
      }
    }
    
    // Display in interface
    this.displayMessages();
  }
  
  /**
   * Reset message list (useful for debugging or when switching views)
   */
  static resetMessages() {
    console.log('Delta Green UI | Resetting message list');
    this.messages = [];
    this.loadMessages();
  }
  
  /**
   * Format sender name
   * @param {User} user - User who sent the message
   * @returns {string} Formatted name
   */
  static formatSenderName(user) {
    // If GM, display "Handler"
    if (user.isGM) {
      return "HANDLER";
    }
    
    // Otherwise, display player name
    return user.name.toUpperCase();
  }
  
  /**
   * Display messages in interface
   */
  static displayMessages() {
    const container = $('#dg-messages-container');
    container.empty();
    
    if (this.messages.length === 0) {
      container.append('<p>NO MESSAGES</p>');
      return;
    }
    
    // Add each message
    this.messages.forEach(msg => {
      const messageDiv = $(`<div class="dg-message"></div>`);
      
      // Determine name color based on user
      const user = game.users.find(u => {
        if (u.isGM && msg.sender === "HANDLER") return true;
        return u.name.toUpperCase() === msg.sender;
      });
      
      const color = user ? user.color : "#33ff33";
      
      // Add name and content
      messageDiv.append(`<div class="dg-message-sender" style="color: ${color}">${msg.sender}</div>`);
      messageDiv.append(`<div class="dg-message-content">${msg.content}</div>`);
      
      container.append(messageDiv);
    });
    
    // Scroll to bottom
    container.scrollTop(container[0].scrollHeight);
  }
  
  /**
   * Handle new chat message - simplified to not interfere with chat processing
   * @param {ChatLog} chatLog - Chat log
   * @param {string} messageText - Message text
   * @param {Object} chatData - Message data
   */
  static handleChatMessage(chatLog, messageText, chatData) {
    // This method is no longer used since we removed the chatMessage hook
    // All chat processing is now handled normally by Foundry
    console.log('Delta Green UI | handleChatMessage called but not intercepting');
    return true; // Always allow normal processing
  }
  
  /**
   * Render chat message
   * @param {ChatMessage} message - Message
   * @param {jQuery} html - HTML element
   * @param {Object} data - Message data
   */
  static renderChatMessage(message, html, data) {
    // Check if message already exists to avoid duplicates
    const existingMessage = this.messages.find(m => m.id === message.id);
    if (existingMessage) {
      console.log('Delta Green UI | Message already exists, skipping:', message.id);
      return;
    }
    
    // Check if this is a roll message from our interface and apply custom styling
    let content = message.content;
    if (message.flavor && message.flavor.includes('Lancé depuis l\'interface Delta Green') && message.rolls && message.rolls.length > 0) {
      // Get the roll total
      const roll = message.rolls[0];
      const total = roll.total;
      
      // Create custom styled content
      content = `
        <div class="dg-roll-result">
          <div class="dg-roll-value">${total}</div>
        </div>
      `;
    }
    
    // Add message to list with potentially modified content
    this.messages.push({
      id: message.id,
      sender: this.formatSenderName(message.user),
      content: content,
      timestamp: message.timestamp
    });
    
    // Keep only the last 50 messages to avoid memory issues
    if (this.messages.length > 50) {
      this.messages = this.messages.slice(-50);
    }
    
    // Update display
    this.displayMessages();
  }
  
  /**
   * Send message
   * @param {string} content - Message content
   */
  static async sendMessage(content) {
    if (!content.trim()) return;
    
    try {
      // Check if it's a roll command
      if (content.startsWith('/roll') || content.startsWith('/r') || 
          content.startsWith('/gmroll') || content.startsWith('/blindroll') ||
          content.startsWith('/selfroll') || content.includes('[[') || content.includes('{{')) {
        
        // For roll commands, use the chat processor to handle them properly
        console.log('Delta Green UI | Processing roll command:', content);
        
        // Use the chat processor for roll commands (Foundry v12 compatible)
        const chatData = {
          user: game.user.id,
          speaker: ChatMessage.getSpeaker(),
          content: content
        };
        
        // Process the command through Foundry's chat system
        await ChatMessage.create(chatData);
        
      } else {
        // For regular messages, create directly
        await ChatMessage.create({
          content: content,
          user: game.user.id,
          speaker: ChatMessage.getSpeaker(),
          type: CONST.CHAT_MESSAGE_TYPES.OTHER
        });
      }
      
      // Reload messages after sending
      setTimeout(() => {
        this.loadMessages();
      }, 100);
      
    } catch (error) {
      console.error('Delta Green UI | Error sending message:', error);
      ui.notifications.error("Erreur lors de l'envoi du message");
    }
  }
}
