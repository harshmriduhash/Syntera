/**
 * Post-build script to flatten TypeScript output structure
 * Moves files from dist/services/agent/src/ to dist/
 * Rewrites @syntera/shared imports to relative paths
 */

import { readdir, stat, copyFile, mkdir, rm, readFile, writeFile } from 'fs/promises'
import { join, dirname, relative } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const distRoot = join(__dirname, '..', 'dist')
const nestedPath = join(distRoot, 'services', 'agent', 'src')
const sharedDistPath = join(__dirname, '..', '..', '..', 'shared', 'dist')

/**
 * Rewrite @syntera/shared imports to relative paths
 */
async function rewriteImports(filePath) {
  const content = await readFile(filePath, 'utf-8')
  
  // Calculate relative path from this file to shared/dist
  const fileDir = dirname(filePath)
  const relativeToShared = relative(fileDir, sharedDistPath)
  
  // Helper function to convert import path
  // Handles directory imports (e.g., 'models' -> 'models/index.js')
  function convertImportPath(importPath) {
    // If importPath doesn't end with .js, check if it's a directory
    // For ES modules, directory imports must explicitly use /index.js
    if (!importPath.endsWith('.js') && !importPath.endsWith('.json')) {
      // Check if this path exists as a directory in shared/dist
      // For now, we'll assume common patterns:
      // - 'models' -> 'models/index.js'
      // - 'logger' -> 'logger/index.js'
      // - 'utils' -> 'utils/index.js'
      // etc.
      // If it already has a trailing slash, remove it and add index.js
      const cleanPath = importPath.replace(/\/$/, '')
      return `${cleanPath}/index.js`
    }
    return importPath
  }
  
  // Replace @syntera/shared/* imports with relative paths
  // Handles both: import ... from '@syntera/shared/...' and import('@syntera/shared/...')
  let rewritten = content.replace(
    /from ['"]@syntera\/shared\/([^'"]+)['"]/g,
    (match, importPath) => {
      // Convert @syntera/shared/models -> ../../shared/dist/models/index.js
      const convertedPath = convertImportPath(importPath)
      const relativePath = join(relativeToShared, convertedPath).replace(/\\/g, '/')
      return `from '${relativePath}'`
    }
  )
  
  // Handle dynamic imports: import('@syntera/shared/...')
  rewritten = rewritten.replace(
    /import\(['"]@syntera\/shared\/([^'"]+)['"]\)/g,
    (match, importPath) => {
      const convertedPath = convertImportPath(importPath)
      const relativePath = join(relativeToShared, convertedPath).replace(/\\/g, '/')
      return `import('${relativePath}')`
    }
  )
  
  // Handle require-style (if any): require('@syntera/shared/...')
  rewritten = rewritten.replace(
    /require\(['"]@syntera\/shared\/([^'"]+)['"]\)/g,
    (match, importPath) => {
      const convertedPath = convertImportPath(importPath)
      const relativePath = join(relativeToShared, convertedPath).replace(/\\/g, '/')
      return `require('${relativePath}')`
    }
  )
  
  if (rewritten !== content) {
    await writeFile(filePath, rewritten, 'utf-8')
  }
}

async function flattenDist() {
  try {
    // Check if nested structure exists
    try {
      await stat(nestedPath)
    } catch {
      console.log('No nested structure found, dist is already flat')
      return
    }

    console.log('Flattening dist structure...')
    console.log(`Source: ${nestedPath}`)
    console.log(`Target: ${distRoot}`)

    // Copy all files from nested structure to root
    async function copyRecursive(src, dest) {
      const entries = await readdir(src, { withFileTypes: true })

      for (const entry of entries) {
        const srcPath = join(src, entry.name)
        const destPath = join(dest, entry.name)

        if (entry.isDirectory()) {
          await mkdir(destPath, { recursive: true })
          await copyRecursive(srcPath, destPath)
        } else {
          // Ensure destination directory exists
          await mkdir(dirname(destPath), { recursive: true })
          await copyFile(srcPath, destPath)
          
          // Rewrite imports in JS files
          if (entry.name.endsWith('.js')) {
            await rewriteImports(destPath)
          }
        }
      }
    }

    // Copy files from nested structure to dist root
    await copyRecursive(nestedPath, distRoot)

    // Verify critical files exist after copy
    const servicesOpenaiPath = join(distRoot, 'services', 'openai.js')
    try {
      await stat(servicesOpenaiPath)
      console.log('✅ Verified: services/openai.js exists after copy')
    } catch {
      console.error('❌ ERROR: services/openai.js NOT FOUND after copy!')
      console.error(`Expected at: ${servicesOpenaiPath}`)
      console.error('Listing dist directory:')
      try {
        const distContents = await readdir(distRoot)
        console.error('Dist contents:', distContents)
      } catch (e) {
        console.error('Could not list dist:', e)
      }
      throw new Error('services/openai.js not found after copy')
    }

    // Remove nested structure (only the TypeScript output directories, not our copied files)
    console.log('Removing nested structure...')
    // Remove dist/services/agent/ (the nested TypeScript output)
    // But keep dist/services/ (our actual service files that we just copied)
    const nestedServicesAgentPath = join(distRoot, 'services', 'agent')
    try {
      // Only remove if it's the nested structure (contains 'src' subdirectory)
      const agentSrcPath = join(nestedServicesAgentPath, 'src')
      try {
        await stat(agentSrcPath)
        console.log('Removing nested dist/services/agent/ directory...')
        await rm(nestedServicesAgentPath, { recursive: true, force: true })
        console.log('✅ Removed nested dist/services/agent/')
      } catch {
        // No 'src' subdirectory, so it's not the nested structure - don't remove
        console.log('⚠️  dist/services/agent/ exists but is not nested structure, keeping it')
      }
    } catch (error) {
      // Directory doesn't exist, that's fine
      console.log('dist/services/agent/ does not exist, nothing to remove')
    }
    
    // Remove dist/shared/ (if TypeScript copied it, but we use the actual shared/dist)
    const nestedSharedPath = join(distRoot, 'shared')
    try {
      await stat(nestedSharedPath)
      // Only remove if it's the nested TypeScript output, not if it's our copied files
      // Check if it contains 'src' subdirectory (TypeScript output structure)
      try {
        await stat(join(nestedSharedPath, 'src'))
        await rm(nestedSharedPath, { recursive: true, force: true })
        console.log('✅ Removed nested dist/shared/')
      } catch {
        // No 'src' subdirectory, so it might be our copied files - don't remove
        console.log('⚠️  dist/shared/ exists but is not nested structure, keeping it')
      }
    } catch {
      // Directory doesn't exist, ignore
    }

    // Final verification
    try {
      await stat(servicesOpenaiPath)
      console.log('✅ Final verification: services/openai.js still exists')
    } catch {
      console.error('❌ ERROR: services/openai.js was removed during cleanup!')
      throw new Error('services/openai.js was removed during cleanup')
    }

    console.log('✅ Dist structure flattened successfully')
    console.log(`✅ index.js should now be at: ${join(distRoot, 'index.js')}`)
  } catch (error) {
    console.error('❌ Error flattening dist:', error)
    process.exit(1)
  }
}

flattenDist()

