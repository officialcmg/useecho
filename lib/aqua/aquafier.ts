// For Next.js/React/Web applications, use the /web import
import Aquafier, { 
  type AquaTree, 
  type FileObject, 
  type Result, 
  type AquaOperationData, 
  type LogData,
  type InlineSignerOptions,
  type InlineWitnessOptions,
  isOk,
  isErr
} from 'aqua-js-sdk/web'
import { blobToArrayBuffer } from '@/lib/utils'

// Export types for use in components
export type { AquaTree, FileObject, Result, AquaOperationData, LogData }
export { isOk, isErr }

export function createAquafier() {
  return new Aquafier()
}

/**
 * Create a genesis revision (first chunk of audio)
 * enableContent=true embeds content IN the revision
 * This way verification works without needing external files
 */
export async function createGenesisRevision(
  aquafier: Aquafier,
  audioBlob: Blob,
  fileName: string
): Promise<Result<AquaOperationData, LogData[]>> {
  const fileContent = await blobToArrayBuffer(audioBlob)
  
  const fileObject: FileObject = {
    fileName,
    fileContent: new Uint8Array(fileContent),
    path: `/${fileName}`, // Virtual path for browser
  }
  
  // Params: fileObject, isForm, enableContent, enableScalar
  // enableContent=TRUE embeds the content (works without external files)
  return aquafier.createGenesisRevision(fileObject, false, true, false)
}

/**
 * Create a content revision (subsequent audio chunks)
 * enableScalar=false uses tree mode (Merkle root) to match genesis revision
 * 
 * NOTE: There's a bug in aqua-js-sdk where enableScalar is INVERTED for content revisions!
 * - enableScalar=true incorrectly uses Merkle tree hashing
 * - enableScalar=false incorrectly uses scalar hashing
 * This is backwards compared to all other revision types.
 * We use false here to match the genesis revision's tree mode.
 */
export async function createContentRevision(
  aquafier: Aquafier,
  aquaTree: AquaTree,
  audioBlob: Blob,
  fileName: string,
  prevHash: string
): Promise<Result<AquaOperationData, LogData[]>> {
  const fileContent = await blobToArrayBuffer(audioBlob)
  
  const fileObject: FileObject = {
    fileName,
    fileContent: new Uint8Array(fileContent),
    path: `/${fileName}`,
  }
  
  // enableScalar=FALSE - Due to SDK bug, this actually uses scalar mode (what we want)
  // This matches the genesis revision's mode
  return aquafier.createContentRevision(
    { aquaTree, revision: prevHash, fileObject },  // Pass the fileObject, not undefined!
    fileObject,
    false // Use FALSE to work around SDK bug and match genesis
  )
}

/**
 * Sign a revision with Privy wallet (inline signing)
 */
export async function signRevision(
  aquafier: Aquafier,
  aquaTree: AquaTree,
  signature: string,
  walletAddress: string,
  prevHash: string
): Promise<Result<AquaOperationData, LogData[]>> {
  const inlineSignerOptions: InlineSignerOptions = {
    walletAddress,
    signature,
  }
  
  // Create empty credentials (not used for inline signing)
  const credentials = {
    mnemonic: '',
    nostr_sk: '',
    did_key: '',
    alchemy_key: '',
    witness_eth_network: '',
    witness_method: '',
  }
  
  return aquafier.signAquaTree(
    { aquaTree, revision: prevHash, fileObject: undefined },
    'inline',
    credentials,
    false, // enableScalar
    undefined, // reactNativeOptions
    inlineSignerOptions
  )
}

/**
 * Witness a revision on Nostr network
 */
export async function witnessOnNostr(
  aquafier: Aquafier,
  aquaTree: AquaTree,
  prevHash: string,
  nostrPrivateKey: string,
  eventId: string,
  walletAddress: string
): Promise<Result<AquaOperationData, LogData[]>> {
  const inlineWitnessOptions: InlineWitnessOptions = {
    transaction_hash: eventId,
    wallet_address: walletAddress,
  }
  
  const credentials = {
    mnemonic: '',
    nostr_sk: nostrPrivateKey,
    did_key: '',
    alchemy_key: '',
    witness_eth_network: '',
    witness_method: 'inline',
  }
  
  return aquafier.witnessAquaTree(
    { aquaTree, revision: prevHash, fileObject: undefined },
    'nostr',
    'mainnet', // not used for nostr but required
    'inline',
    credentials,
    false, // enableScalar
    inlineWitnessOptions
  )
}

/**
 * Verify an entire Aqua Tree (basic verification)
 */
export async function verifyAquaTree(
  aquafier: Aquafier,
  aquaTree: AquaTree,
  fileObjects: FileObject[] = []
): Promise<Result<AquaOperationData, LogData[]>> {
  return aquafier.verifyAquaTree(aquaTree, fileObjects)
}

/**
 * Calculate SHA-256 hash of file content (for manual verification)
 */
async function calculateFileHash(fileContent: ArrayBuffer | Uint8Array): Promise<string> {
  // Ensure we have a Uint8Array
  const uint8Array = fileContent instanceof Uint8Array ? fileContent : new Uint8Array(fileContent)
  // TypeScript complains about SDK's Uint8Array<ArrayBufferLike> type, but it works at runtime
  const hashBuffer = await crypto.subtle.digest('SHA-256', uint8Array as any)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  // NOTE: SDK stores file_hash WITHOUT '0x' prefix, so we match that format
  return hashHex
}

/**
 * Manually verify file content by comparing hashes
 * Extracts file_hash from AquaTree and compares with provided file
 */
export async function verifyFileContentManually(
  aquaTree: AquaTree,
  fileName: string,
  fileContent: Uint8Array
): Promise<{
  success: boolean
  expectedHash?: string
  actualHash?: string
  error?: string
}> {
  try {
    // Look up the revision key for this file in file_index
    // Don't just take the last revision - there may be signature revisions after the content revision!
    let revisionKey: string | undefined = undefined
    
    // Search file_index for the fileName
    for (const [key, indexedFileName] of Object.entries(aquaTree.file_index)) {
      if (indexedFileName === fileName) {
        revisionKey = key
        break
      }
    }
    
    if (!revisionKey) {
      return { 
        success: false, 
        error: `File "${fileName}" not found in AquaTree file_index` 
      }
    }
    
    const revision = aquaTree.revisions[revisionKey]
    if (!revision) {
      return { 
        success: false, 
        error: `Revision "${revisionKey}" not found in AquaTree` 
      }
    }
    
    console.log('🔍 Manual verification for:', fileName)
    console.log('  Revision key from file_index:', revisionKey)
    console.log('  Revision file_hash:', revision.file_hash)
    
    // Check if file_hash exists
    if (!revision.file_hash) {
      return { 
        success: false, 
        error: 'file_hash is undefined in revision',
        expectedHash: 'undefined'
      }
    }
    
    // Calculate hash of provided file
    const actualHash = await calculateFileHash(fileContent)
    const expectedHash = revision.file_hash
    
    console.log('  Expected hash (from AquaTree):', expectedHash)
    console.log('  Actual hash (from file):', actualHash)
    
    const success = actualHash === expectedHash
    
    return {
      success,
      expectedHash,
      actualHash,
      error: success ? undefined : 'Hash mismatch - file has been tampered with'
    }
  } catch (error) {
    return {
      success: false,
      error: `Verification error: ${error instanceof Error ? error.message : String(error)}`
    }
  }
}

/**
 * Verify an Aqua Tree with proper external file content verification
 * 
 * This function handles the case where revisions have embedded content
 * but we still want to verify external file content matches.
 * 
 * Returns detailed verification results including:
 * - Structure verification (hash chain, signatures, embedded chunks)
 * - External file content verification (if files provided)
 */
export async function verifyAquaTreeWithExternalFiles(
  aquafier: Aquafier,
  aquaTree: AquaTree,
  fileObjects: FileObject[]
): Promise<{
  structureSuccess: boolean
  structureData: AquaOperationData | null
  structureErrors: LogData[] | null
  contentVerified: boolean
  contentData: AquaOperationData | null
  contentErrors: LogData[] | null
  overallSuccess: boolean
}> {
  console.log('🔍 === VERIFICATION DEBUG ===')
  console.log('📁 Provided fileObjects:', fileObjects.map(f => f.fileName))
  console.log('🗂️  AquaTree file_index:', JSON.stringify(aquaTree.file_index))
  
  // Stage 1: Verify structure with embedded content (chunks)
  const structureResult = await aquafier.verifyAquaTree(aquaTree, [])
  const structureSuccess = isOk(structureResult)
  
  console.log('✅ Structure verification:', structureSuccess)
  
  // Stage 2: Verify external file content for final revision
  // If no files provided, content verification is not applicable (default to true)
  let contentVerified = fileObjects.length === 0 ? true : false
  let contentData: AquaOperationData | null = null
  let contentErrors: LogData[] | null = null
  
  if (fileObjects.length > 0) {
    // Create a shallow clone of the AquaTree
    const aquaTreeClone = { ...aquaTree }
    
    // Clone the revisions object shallowly
    aquaTreeClone.revisions = { ...aquaTree.revisions }
    
    // Get the last revision key (final combined audio)
    const revisionKeys = Object.keys(aquaTreeClone.revisions)
    const finalRevisionKey = revisionKeys[revisionKeys.length - 1]
    
    console.log('🔑 Final revision key:', finalRevisionKey)
    console.log('📝 Final revision file_hash:', aquaTreeClone.revisions[finalRevisionKey]?.file_hash)
    console.log('📦 Final revision has embedded content:', !!aquaTreeClone.revisions[finalRevisionKey]?.content)
    
    if (finalRevisionKey) {
      // Clone just the final revision and remove its embedded content
      const finalRevision = { ...aquaTreeClone.revisions[finalRevisionKey] }
      const hadContent = !!finalRevision.content
      delete finalRevision.content
      aquaTreeClone.revisions[finalRevisionKey] = finalRevision
      
      console.log('🗑️  Removed embedded content from final revision:', hadContent)
      console.log('🔍 Verifying with external files...')
      
      // Now verify with external files - SDK should check file_index against provided files
      const contentResult = await aquafier.verifyAquaTree(
        aquaTreeClone, fileObjects
      )
      
      contentVerified = isOk(contentResult)
      contentData = isOk(contentResult) ? contentResult.data : null
      contentErrors = isErr(contentResult) ? contentResult.data : null
      
      console.log('📊 Content verification result:', contentVerified)
      if (contentErrors) {
        console.log('❌ Content verification errors:', contentErrors.length, 'errors')
      }
      if (contentData?.logData) {
        console.log('📋 Verification logs:', contentData.logData.length, 'log entries')
      }
    }
  }
  
  console.log('🏁 Overall success:', structureSuccess && contentVerified)
  console.log('=== END VERIFICATION DEBUG ===')
  
  return {
    structureSuccess,
    structureData: isOk(structureResult) ? structureResult.data : null,
    structureErrors: isErr(structureResult) ? structureResult.data : null,
    contentVerified,
    contentData,
    contentErrors,
    overallSuccess: structureSuccess && contentVerified
  }
}
