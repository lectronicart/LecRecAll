import { v4 as uuidv4 } from 'uuid';
import getDatabase from '../db/index.js';
import { summarize, extractTags, extractConcepts } from './ai.js';

/**
 * Enrichment pipeline: runs after a card is created.
 * 1. Summarize content
 * 2. Extract and assign tags
 * 3. Extract concepts
 * 4. Find connections to other cards via shared concepts
 */
export async function enrichCard(cardId: string): Promise<void> {
  const db = getDatabase();
  const card = db.prepare('SELECT * FROM cards WHERE id = ?').get(cardId) as any;
  if (!card) return;

  const content = card.content_markdown || card.content_raw || '';
  if (!content || content.length < 50) return;

  console.log(`🔄 Enriching card: ${card.title}`);

  try {
    // 1. Summarize
    const { summary, key_takeaways } = await summarize(content, card.title);
    db.prepare('UPDATE cards SET summary = ?, key_takeaways = ?, updated_at = datetime(\'now\') WHERE id = ?')
      .run(summary, JSON.stringify(key_takeaways), cardId);
    console.log(`  ✓ Summary generated`);

    // 2. Extract tags
    const existingTags = db.prepare('SELECT name FROM tags').all().map((t: any) => t.name);
    const suggestedTags = await extractTags(content, card.title, existingTags);

    for (const tagName of suggestedTags) {
      const normalized = tagName.toLowerCase().trim();
      if (!normalized) continue;

      // Create tag if doesn't exist
      let tag = db.prepare('SELECT id FROM tags WHERE name = ?').get(normalized) as any;
      if (!tag) {
        const tagId = uuidv4();
        db.prepare('INSERT INTO tags (id, name) VALUES (?, ?)').run(tagId, normalized);
        tag = { id: tagId };
      }

      // Link to card
      db.prepare('INSERT OR IGNORE INTO card_tags (card_id, tag_id, is_ai_suggested) VALUES (?, ?, 1)')
        .run(cardId, tag.id);

      // Update usage count
      db.prepare('UPDATE tags SET usage_count = (SELECT COUNT(*) FROM card_tags WHERE tag_id = ?) WHERE id = ?')
        .run(tag.id, tag.id);
    }
    console.log(`  ✓ Tags assigned: ${suggestedTags.join(', ')}`);

    // 3. Extract concepts
    const concepts = await extractConcepts(content, card.title);

    for (const concept of concepts) {
      const normalized = concept.name.toLowerCase().trim();
      if (!normalized) continue;

      let existing = db.prepare('SELECT id FROM concepts WHERE name = ?').get(normalized) as any;
      if (!existing) {
        const conceptId = uuidv4();
        db.prepare('INSERT INTO concepts (id, name, description) VALUES (?, ?, ?)')
          .run(conceptId, normalized, concept.description);
        existing = { id: conceptId };
      }

      db.prepare('INSERT OR IGNORE INTO card_concepts (card_id, concept_id) VALUES (?, ?)')
        .run(cardId, existing.id);

      db.prepare('UPDATE concepts SET usage_count = (SELECT COUNT(*) FROM card_concepts WHERE concept_id = ?) WHERE id = ?')
        .run(existing.id, existing.id);
    }
    console.log(`  ✓ Concepts extracted: ${concepts.map(c => c.name).join(', ')}`);

    // 4. Find connections
    const cardConcepts = db.prepare(
      'SELECT c.name FROM concepts c JOIN card_concepts cc ON c.id = cc.concept_id WHERE cc.card_id = ?'
    ).all(cardId).map((c: any) => c.name);

    if (cardConcepts.length > 0) {
      // Find other cards sharing concepts
      const otherCards = db.prepare(`
        SELECT DISTINCT cc.card_id, GROUP_CONCAT(c.name) as shared, COUNT(*) as shared_count
        FROM card_concepts cc
        JOIN concepts c ON c.id = cc.concept_id
        WHERE cc.card_id != ? AND c.name IN (${cardConcepts.map(() => '?').join(',')})
        GROUP BY cc.card_id
        HAVING shared_count >= 1
        ORDER BY shared_count DESC
        LIMIT 20
      `).all(cardId, ...cardConcepts) as any[];

      for (const other of otherCards) {
        const strength = Math.min(other.shared_count / Math.max(cardConcepts.length, 1), 1.0);
        const sharedConcepts = other.shared.split(',');

        // Ensure consistent ordering (smaller ID first)
        const [idA, idB] = [cardId, other.card_id].sort();

        db.prepare(`
          INSERT INTO connections (id, card_id_a, card_id_b, strength, shared_concepts)
          VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(card_id_a, card_id_b) DO UPDATE SET
            strength = ?, shared_concepts = ?
        `).run(
          uuidv4(), idA, idB, strength, JSON.stringify(sharedConcepts),
          strength, JSON.stringify(sharedConcepts)
        );
      }
      console.log(`  ✓ Found ${otherCards.length} connections`);
    }

    console.log(`✅ Enrichment complete for: ${card.title}`);
  } catch (error) {
    console.error(`❌ Enrichment failed for card ${cardId}:`, error);
    // Don't throw — the card was still saved, just not enriched
  }
}
