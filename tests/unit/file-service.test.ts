import { mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { openVault, closeVault, scanVault } from '../../electron/services/vault.service';
import { createFolder, createNote, hashContent, readNote, saveNote } from '../../electron/services/file.service';

async function run(): Promise<void> {
  const rootPath = path.join(os.tmpdir(), `schola-file-service-${Date.now()}`);
  await mkdir(rootPath, { recursive: true });

  // Override env so openVault uses this temp directory
  const originalEnv = process.env.SCHOLA_TEST_VAULT_PATH;
  process.env.SCHOLA_TEST_VAULT_PATH = rootPath;

  try {
    // Write a test Markdown file
    const testContent = '# Test Note\n\nHello, Schola.';
    await writeFile(path.join(rootPath, 'test.md'), testContent, 'utf-8');

    // Open vault (registers it in vaults map)
    const vaultInfo = await openVault();
    assert.ok(vaultInfo, 'openVault should return vault info');
    assert.equal(vaultInfo!.name, path.basename(rootPath));

    // Test hashContent
    const hash = hashContent(testContent);
    assert.equal(typeof hash, 'string');
    assert.equal(hash.length, 64, 'SHA-256 hash should be 64 hex chars');
    assert.equal(hashContent(testContent), hash, 'hashContent should be deterministic');

    // Test readNote
    const note = await readNote(vaultInfo!.id, 'test.md');
    assert.equal(note.content, testContent);
    assert.equal(note.hash, hash);
    assert.equal(note.relativePath, 'test.md');

    // Test saveNote with matching hash (should succeed)
    const newContent = '# Updated\n\nModified content.';
    const saveResult = await saveNote(vaultInfo!.id, 'test.md', newContent, hash);
    assert.equal(saveResult.relativePath, 'test.md');
    assert.notEqual(saveResult.hash, hash, 'hash should change after save');

    // Verify the file was actually written
    const updatedNote = await readNote(vaultInfo!.id, 'test.md');
    assert.equal(updatedNote.content, newContent);

    // Test saveNote with mismatched hash (should throw HASH_CONFLICT)
    await assert.rejects(
      () => saveNote(vaultInfo!.id, 'test.md', 'different content', hash),
      /HASH_CONFLICT/,
      'saveNote should reject with HASH_CONFLICT when expectedHash does not match',
    );

    // Test saveNote with null hash (should skip conflict check)
    const nullHashResult = await saveNote(vaultInfo!.id, 'test.md', 'no conflict check', null);
    assert.equal(nullHashResult.relativePath, 'test.md');

    // Test createNote at vault root with automatic .md extension
    const createRootNoteResult = await createNote(vaultInfo!.id, {
      parentRelativePath: '',
      fileName: 'new-note',
      initialContent: '# New Note',
    });
    assert.equal(createRootNoteResult.ok, true);
    assert.equal(createRootNoteResult.relativePath, 'new-note.md');
    assert.equal(await readFile(path.join(rootPath, 'new-note.md'), 'utf-8'), '# New Note');

    // Test createFolder and createNote inside that folder
    const createFolderResult = await createFolder(vaultInfo!.id, {
      parentRelativePath: '',
      folderName: '资料',
    });
    assert.equal(createFolderResult.ok, true);
    assert.equal(createFolderResult.relativePath, '资料');

    const createNestedNoteResult = await createNote(vaultInfo!.id, {
      parentRelativePath: '资料',
      fileName: 'nested.markdown',
    });
    assert.equal(createNestedNoteResult.ok, true);
    assert.equal(createNestedNoteResult.relativePath, '资料/nested.markdown');

    // Empty folders should be visible after scan so newly created folders can appear in the explorer
    const createEmptyFolderResult = await createFolder(vaultInfo!.id, {
      parentRelativePath: '',
      folderName: 'empty-folder',
    });
    assert.equal(createEmptyFolderResult.ok, true);
    const fileTree = await scanVault(vaultInfo!.id);
    assert.ok(fileTree.some((entry) => entry.type === 'directory' && entry.relativePath === 'empty-folder'));

    // Test validation and overwrite errors return structured codes
    const invalidParentResult = await createNote(vaultInfo!.id, {
      parentRelativePath: '../outside',
      fileName: 'escape',
    });
    assert.equal(invalidParentResult.ok, false);
    assert.equal(invalidParentResult.code, 'PATH_OUTSIDE_VAULT');

    const invalidNameResult = await createNote(vaultInfo!.id, {
      parentRelativePath: '',
      fileName: 'not-markdown.txt',
    });
    assert.equal(invalidNameResult.ok, false);
    assert.equal(invalidNameResult.code, 'INVALID_NAME');

    const hiddenNoteResult = await createNote(vaultInfo!.id, {
      parentRelativePath: '',
      fileName: '.hidden.md',
    });
    assert.equal(hiddenNoteResult.ok, false);
    assert.equal(hiddenNoteResult.code, 'INVALID_NAME');

    const hiddenFolderResult = await createFolder(vaultInfo!.id, {
      parentRelativePath: '',
      folderName: '.hidden',
    });
    assert.equal(hiddenFolderResult.ok, false);
    assert.equal(hiddenFolderResult.code, 'INVALID_NAME');

    const skippedFolderResult = await createFolder(vaultInfo!.id, {
      parentRelativePath: '',
      folderName: 'node_modules',
    });
    assert.equal(skippedFolderResult.ok, false);
    assert.equal(skippedFolderResult.code, 'INVALID_NAME');

    await mkdir(path.join(rootPath, '.hidden-parent'), { recursive: true });
    const hiddenParentResult = await createNote(vaultInfo!.id, {
      parentRelativePath: '.hidden-parent',
      fileName: 'child',
    });
    assert.equal(hiddenParentResult.ok, false);
    assert.equal(hiddenParentResult.code, 'INVALID_PARENT_PATH');

    const trailingDotFolderResult = await createFolder(vaultInfo!.id, {
      parentRelativePath: '',
      folderName: 'invalid-folder.',
    });
    assert.equal(trailingDotFolderResult.ok, false);
    assert.equal(trailingDotFolderResult.code, 'INVALID_NAME');

    const duplicateNoteResult = await createNote(vaultInfo!.id, {
      parentRelativePath: '',
      fileName: 'new-note.md',
    });
    assert.equal(duplicateNoteResult.ok, false);
    assert.equal(duplicateNoteResult.code, 'FILE_ALREADY_EXISTS');

    const duplicateFolderResult = await createFolder(vaultInfo!.id, {
      parentRelativePath: '',
      folderName: '资料',
    });
    assert.equal(duplicateFolderResult.ok, false);
    assert.equal(duplicateFolderResult.code, 'FOLDER_ALREADY_EXISTS');

    const fileAsParentResult = await createFolder(vaultInfo!.id, {
      parentRelativePath: 'new-note.md',
      folderName: 'child',
    });
    assert.equal(fileAsParentResult.ok, false);
    assert.equal(fileAsParentResult.code, 'PARENT_NOT_DIRECTORY');

    const outsidePath = path.join(os.tmpdir(), `schola-file-service-outside-${Date.now()}`);
    await mkdir(outsidePath, { recursive: true });
    try {
      await symlink(outsidePath, path.join(rootPath, 'outside-link'), 'dir');
      const symlinkParentResult = await createNote(vaultInfo!.id, {
        parentRelativePath: 'outside-link',
        fileName: 'escaped',
      });
      assert.equal(symlinkParentResult.ok, false);
      assert.equal(symlinkParentResult.code, 'PATH_OUTSIDE_VAULT');
    } finally {
      await rm(outsidePath, { recursive: true, force: true });
    }

    // Cleanup: close vault
    closeVault(vaultInfo!.id);

    // Verify readNote fails after vault closed
    await assert.rejects(
      () => readNote(vaultInfo!.id, 'test.md'),
      /Vault is not open/,
      'readNote should reject when vault is closed',
    );
  } finally {
    process.env.SCHOLA_TEST_VAULT_PATH = originalEnv;
    await rm(rootPath, { recursive: true, force: true });
  }
}

run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
