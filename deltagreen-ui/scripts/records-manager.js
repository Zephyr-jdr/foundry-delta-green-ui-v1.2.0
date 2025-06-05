/**
 * Records Manager for Delta Green Player UI
 */

import { DeltaGreenUI } from './delta-green-ui.js';

export class RecordsManager {
  static currentRecordId = null;
  
  /**
   * Initialize records manager
   */
  static init() {
    console.log('Delta Green UI | Initializing records manager');
    
    // Initial loading of records
    Hooks.on('renderDeltaGreenUI', () => {
      this.loadRecords();
      
      // S'assurer que tous les acteurs dans le dossier PC Records ont les bonnes permissions
      this.ensureRecordsPermissions();
    });
    
    // S'assurer que les permissions sont correctes à chaque fois qu'un acteur est créé ou mis à jour
    Hooks.on('createActor', (actor) => {
      if (actor.folder?.name === "PC Records") {
        this.ensureActorPermissions(actor);
      }
    });
    
    Hooks.on('updateActor', (actor) => {
      if (actor.folder?.name === "PC Records") {
        this.ensureActorPermissions(actor);
      }
    });
  }
  
  /**
   * S'assurer que tous les acteurs dans le dossier PC Records ont les permissions correctes
   * pour que tous les joueurs puissent les modifier
   */
  static async ensureRecordsPermissions() {
    console.log('Delta Green UI | Ensuring all records have correct permissions');
    
    // Trouver le dossier PC Records
    const folder = game.folders.find(f => f.name === "PC Records" && f.type === "Actor");
    if (!folder) return;
    
    // Récupérer tous les acteurs dans ce dossier
    const records = game.actors.filter(a => a.folder?.id === folder.id);
    
    // Mettre à jour les permissions de chaque acteur
    for (const record of records) {
      await this.ensureActorPermissions(record);
    }
  }
  
  /**
   * S'assurer qu'un acteur spécifique a les permissions correctes
   * @param {Actor} actor - L'acteur à vérifier
   */
  static async ensureActorPermissions(actor) {
    if (!actor) return;
    
    // Vérifier si les permissions sont déjà correctes
    if (actor.permission.default === 3) return;
    
    console.log(`Delta Green UI | Updating permissions for actor: ${actor.name}`);
    
    // Mettre à jour les permissions pour que tous les joueurs puissent éditer
    await actor.update({
      permission: { default: 3 } // 3 = OWNER (droits complets)
    });
  }
  
  /**
   * Load records from "PC Records" folder
   */
  static async loadRecords() {
    // Find PC Records folder
    const folder = game.folders.find(f => f.name === "PC Records" && f.type === "Actor");
    
    if (!folder) return;
    
    // Get actors in this folder
    const records = game.actors.filter(a => a.folder?.id === folder.id);
    
    // Display in interface
    this.displayAllRecords(records);
  }
  
  /**
   * Display all records in list
   * @param {Array} records - List of records to display (optional)
   */
  static displayAllRecords(records = null) {
    // If no records provided, get them
    if (!records) {
      const folder = game.folders.find(f => f.name === "PC Records" && f.type === "Actor");
      if (!folder) return;
      records = game.actors.filter(a => a.folder?.id === folder.id);
    }
    
    const allRecordsList = $('#dg-all-records-list');
    allRecordsList.empty();
    
    if (records.length === 0) {
      allRecordsList.append('<li>NO RECORDS FOUND</li>');
      return;
    }
    
    // Add each record to list
    records.forEach(record => {
      const reference = record.getFlag(DeltaGreenUI.ID, 'surname') || 'UNKNOWN';
      const firstName = record.getFlag(DeltaGreenUI.ID, 'firstName') || '';
      const lastName = record.getFlag(DeltaGreenUI.ID, 'middleName') || '';
      
      const li = $(`<li class="dg-result-item" data-record-id="${record.id}">
        ${reference} - ${firstName} ${lastName}
      </li>`);
      allRecordsList.append(li);
      
      // Add event handler for right click (direct deletion)
      li.on('contextmenu', function(e) {
        e.preventDefault(); // Prevent default context menu
        const recordId = $(this).data('record-id');
        RecordsManager.deleteRecord(recordId);
      });
    });
  }
  
  /**
   * Search records
   * @param {string} searchTerm - Search term
   */
  static searchRecords(searchTerm) {
    // Find PC Records folder
    const folder = game.folders.find(f => f.name === "PC Records" && f.type === "Actor");
    
    if (!folder) return;
    
    // If term is empty, display all records
    if (!searchTerm) {
      this.loadRecords();
      return;
    }
    
    // Search in folder actors
    const records = game.actors.filter(a => {
      if (a.folder?.id !== folder.id) return false;
      
      // Search in name and flags
      const name = a.name.toLowerCase();
      const surname = a.getFlag(DeltaGreenUI.ID, 'surname')?.toLowerCase() || '';
      const firstName = a.getFlag(DeltaGreenUI.ID, 'firstName')?.toLowerCase() || '';
      const searchLower = searchTerm.toLowerCase();
      
      return name.includes(searchLower) || 
             surname.includes(searchLower) || 
             firstName.includes(searchLower);
    });
    
    // Display results
    this.displayAllRecords(records);
  }
  
  /**
   * Display add/edit record form
   * @param {string} recordId - ID of record to edit (null for new)
   */
  static showRecordForm(recordId = null) {
    this.currentRecordId = recordId;
    
    // Generate random case number for new records
    if (!recordId) {
      const caseNumber = Math.floor(Math.random() * 900000) + 100000;
      $('#dg-case-number').text(caseNumber);
    }
    
    // If editing existing record, load its data
    if (recordId) {
      this.showCaseStudyForm(game.actors.get(recordId));
    } else {
      // Reset form for new record
      $('#dg-surname, #dg-firstname, #dg-middlename, #dg-address, #dg-zipcode, #dg-phone, #dg-dob, #dg-race, #dg-height, #dg-weight, #dg-haircolor, #dg-eyecolor, #dg-relationship, #dg-notes').val('');
      $('#dg-sex').val('M');
      
      // Reset image with default image
      $('#dg-profile-avatar').attr('src', 'icons/svg/mystery-man.svg');
      
      // Show form
      $('#dg-case-study-form').show();
      
      // Set up avatar button for new records
      this._setupAvatarButton();
    }
  }
  
  /**
   * Display case study form for specific actor
   * @param {Actor} actor - Actor to display
   */
  static showCaseStudyForm(actor) {
    if (!actor) return;
    
    this.currentRecordId = actor.id;
    
    // Fill form
    $('#dg-case-number').text(actor.getFlag(DeltaGreenUI.ID, 'caseNumber') || '');
    $('#dg-surname').val(actor.getFlag(DeltaGreenUI.ID, 'surname') || '');
    $('#dg-firstname').val(actor.getFlag(DeltaGreenUI.ID, 'firstName') || '');
    $('#dg-middlename').val(actor.getFlag(DeltaGreenUI.ID, 'middleName') || '');
    $('#dg-address').val(actor.getFlag(DeltaGreenUI.ID, 'address') || '');
    $('#dg-zipcode').val(actor.getFlag(DeltaGreenUI.ID, 'zipCode') || '');
    $('#dg-phone').val(actor.getFlag(DeltaGreenUI.ID, 'phone') || '');
    $('#dg-dob').val(actor.getFlag(DeltaGreenUI.ID, 'dateOfBirth') || '');
    $('#dg-sex').val(actor.getFlag(DeltaGreenUI.ID, 'sex') || 'M');
    $('#dg-race').val(actor.getFlag(DeltaGreenUI.ID, 'race') || '');
    $('#dg-height').val(actor.getFlag(DeltaGreenUI.ID, 'height') || '');
    $('#dg-weight').val(actor.getFlag(DeltaGreenUI.ID, 'weight') || '');
    $('#dg-haircolor').val(actor.getFlag(DeltaGreenUI.ID, 'hairColor') || '');
    $('#dg-eyecolor').val(actor.getFlag(DeltaGreenUI.ID, 'eyeColor') || '');
    $('#dg-relationship').val(actor.getFlag(DeltaGreenUI.ID, 'relationshipStatus') || '');
    $('#dg-notes').val(actor.getFlag(DeltaGreenUI.ID, 'notes') || '');
    
    // Display actor image
    const imgSrc = actor.img || 'icons/svg/mystery-man.svg';
    $('#dg-profile-avatar').attr('src', imgSrc);
    
    // Show form
    $('#dg-case-study-form').show();
    
    // Scroll to top of form
    $('#dg-case-study-form').scrollTop(0);
    
    // Event handlers are now managed in UIComponents
    // to ensure proper event delegation
    
    // Add event handler for avatar change button
    this._setupAvatarButton();
  }
  
  // Variable pour stocker temporairement l'avatar d'un nouveau record
  static tempAvatarPath = null;
  
  /**
   * Set up avatar change button
   * @private
   */
  static _setupAvatarButton() {
    // Remove existing event handlers to avoid duplicates
    $('#dg-change-avatar').off('click');
    
    // Add event handler for avatar change button
    $('#dg-change-avatar').on('click', async (event) => {
      event.preventDefault();
      
      // Déterminer l'image actuelle à afficher dans le sélecteur
      let currentImage = "icons/svg/mystery-man.svg";
      
      // Si on édite un record existant
      if (this.currentRecordId) {
        const actor = game.actors.get(this.currentRecordId);
        if (actor) {
          currentImage = actor.img || "icons/svg/mystery-man.svg";
        }
      } 
      // Si on a déjà sélectionné une image temporaire pour un nouveau record
      else if (this.tempAvatarPath) {
        currentImage = this.tempAvatarPath;
      }
      
      // Open Foundry file picker
      const fp = new FilePicker({
        type: "image",
        current: currentImage,
        callback: async (path) => {
          // Update image in interface
          $('#dg-profile-avatar').attr('src', path);
          
          // Si on édite un record existant, mettre à jour l'image de l'acteur
          if (this.currentRecordId) {
            const actor = game.actors.get(this.currentRecordId);
            if (actor) {
              await actor.update({ img: path });
              ui.notifications.info("Image updated successfully");
            }
          } 
          // Sinon, stocker temporairement le chemin de l'image pour l'appliquer lors de la sauvegarde
          else {
            this.tempAvatarPath = path;
            ui.notifications.info("Image selected. It will be applied when the record is saved.");
          }
        },
        title: "Select an image"
      });
      
      // Display file picker
      fp.render(true);
    });
  }
  
  /**
   * Hide form
   */
  static hideRecordForm() {
    $('#dg-case-study-form').hide();
    this.currentRecordId = null;
  }
  
  /**
   * Save record
   */
  static async saveRecord() {
    // Get form values
    const caseNumber = $('#dg-case-number').text();
    const surname = $('#dg-surname').val();
    const firstName = $('#dg-firstname').val();
    
    // Check required fields
    if (!surname || !firstName) {
      ui.notifications.error("Surname and first name are required");
      return;
    }
    
    // Find PC Records folder
    const folder = game.folders.find(f => f.name === "PC Records" && f.type === "Actor");
    
    if (!folder) {
      ui.notifications.error("PC Records folder not found");
      return;
    }
    
    // Prepare data
    const recordData = {
      caseNumber,
      surname,
      firstName,
      middleName: $('#dg-middlename').val(),
      address: $('#dg-address').val(),
      zipCode: $('#dg-zipcode').val(),
      phone: $('#dg-phone').val(),
      dateOfBirth: $('#dg-dob').val(),
      sex: $('#dg-sex').val(),
      race: $('#dg-race').val(),
      height: $('#dg-height').val(),
      weight: $('#dg-weight').val(),
      hairColor: $('#dg-haircolor').val(),
      eyeColor: $('#dg-eyecolor').val(),
      relationshipStatus: $('#dg-relationship').val(),
      notes: $('#dg-notes').val()
    };
    
    try {
      // Edit existing record
      if (this.currentRecordId) {
        const record = game.actors.get(this.currentRecordId);
        
        if (record) {
          // Update flags
          await record.update({
            name: `Case ${caseNumber}: ${surname}, ${firstName}`
          });
          
          // Update flags
          for (const [key, value] of Object.entries(recordData)) {
            await record.setFlag(DeltaGreenUI.ID, key, value);
          }
        }
      } 
      // Create new record
      else {
        // Préparer les données de l'acteur
        const actorData = {
          name: `Case ${caseNumber}: ${surname}, ${firstName}`,
          type: "npc",
          folder: folder.id,
          // Définir les permissions pour que tous les joueurs puissent éditer
          permission: { default: 3 } // 3 = OWNER (droits complets)
        };
        
        // Si un avatar temporaire a été sélectionné, l'utiliser
        if (this.tempAvatarPath) {
          actorData.img = this.tempAvatarPath;
        }
        
        // Create actor
        const record = await Actor.create(actorData);
        
        // Réinitialiser l'avatar temporaire
        this.tempAvatarPath = null;
        
        // Add flags
        for (const [key, value] of Object.entries(recordData)) {
          await record.setFlag(DeltaGreenUI.ID, key, value);
        }
      }
      
      // Success notification
      ui.notifications.info("Record saved successfully");
      
      // Hide form and reload records
      this.hideRecordForm();
      this.loadRecords();
      
    } catch (error) {
      console.error("Error saving record:", error);
      ui.notifications.error("Error saving record");
    }
  }
  
  /**
   * Open record
   * @param {string} recordId - ID of record to open
   */
  static openRecord(recordId) {
    if (!recordId) return;
    
    // Show form in edit mode
    this.showRecordForm(recordId);
  }
  
  /**
   * Delete record
   * @param {string} recordId - ID of record to delete
   */
  static async deleteRecord(recordId) {
    if (!recordId) return;
    
    // Deletion confirmation with custom options to ensure dialog is visible
    const confirmed = await new Promise((resolve) => {
      const d = new Dialog({
        title: "Delete Confirmation",
        content: "Are you sure you want to delete this record? This action cannot be undone.",
        buttons: {
          yes: {
            icon: '<i class="fas fa-check"></i>',
            label: "Yes",
            callback: () => resolve(true)
          },
          no: {
            icon: '<i class="fas fa-times"></i>',
            label: "No",
            callback: () => resolve(false)
          }
        },
        default: "no",
        // Make dialog more visible
        render: (html) => {
          // Increase z-index to ensure it's above CRT interface
          $(html).closest('.app').css('z-index', '10000');
          // Add style to make dialog more visible
          $(html).closest('.app').css('background-color', '#1a1a1a');
          $(html).closest('.app').css('border', '2px solid #ffb000');
          $(html).closest('.app').css('color', '#ffb000');
          $(html).find('.dialog-buttons button').css('background-color', '#ffb000');
          $(html).find('.dialog-buttons button').css('color', '#1a1a1a');
        }
      });
      d.render(true);
    });
    
    if (!confirmed) return;
    
    // Delete actor
    const record = game.actors.get(recordId);
    
    if (record) {
      await record.delete();
      ui.notifications.info("Record deleted successfully");
      this.loadRecords();
    }
  }
}
