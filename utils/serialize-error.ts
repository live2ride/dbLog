export function serializeError(err: unknown): Record<string, any> {
  // WeakSet to track objects already seen to avoid circular references
  const seen = new WeakSet()

  // Helper function to recursively serialize a value.
  function serializeValue(value: any): any {
    if (value instanceof Error) {
      return serializeErrorInternal(value)
    } else if (value && typeof value === "object") {
      if (seen.has(value)) {
        return "[Circular]"
      }
      seen.add(value)
      const output = Array.isArray(value) ? [] : {}
      for (const key of Object.keys(value)) {
        output[key] = serializeValue(value[key])
      }
      return output
    }
    return value
  }

  // Internal function to serialize an Error instance.
  function serializeErrorInternal(error: Error): Record<string, any> {
    if (seen.has(error)) {
      // If the error is already seen, avoid infinite recursion.
      return { name: error.name, message: error.message, circular: true }
    }
    seen.add(error)

    // Start with standard Error properties.
    const serialized: Record<string, any> = {
      name: error.name,
      message: error.message,
      stack: error.stack,
    }

    // If the error has a "cause" property (from ES2022 or custom), serialize it recursively.
    if ("cause" in error) {
      serialized.cause = serializeValue((error as any).cause)
    }

    // Capture additional properties: both string keys and symbol keys (including non-enumerable ones).
    const propNames = Object.getOwnPropertyNames(error)
    const propSymbols = Object.getOwnPropertySymbols(error)
    for (const key of [...propNames, ...propSymbols]) {
      // Convert symbol keys to string representation.
      const propKey = typeof key === "symbol" ? key.toString() : key
      if (!(propKey in serialized)) {
        try {
          serialized[propKey] = serializeValue((error as any)[key])
        } catch (ex) {
          serialized[propKey] = `[Unable to serialize property: ${ex}]`
        }
      }
    }

    return serialized
  }

  // Main serialization logic:
  if (err instanceof Error) {
    return serializeErrorInternal(err)
  }

  // If err is an object with a toJSON method, try to use it.
  if (err && typeof err === "object" && typeof (err as any).toJSON === "function") {
    try {
      return (err as any).toJSON()
    } catch {
      // Fallback to shallow serialization if toJSON throws an error.
    }
  }

  // If err is a plain object (or array), do a shallow copy with recursive serialization.
  if (err && typeof err === "object") {
    const output: Record<string, any> = {}
    for (const key in err) {
      if (Object.prototype.hasOwnProperty.call(err, key)) {
        try {
          output[key] = serializeValue((err as any)[key])
        } catch (ex) {
          output[key] = `[Unable to serialize property: ${ex}]`
        }
      }
    }
    return output
  }

  // For non-object types (string, number, etc.), return a basic object.
  return {
    type: typeof err,
    message: String(err),
  }
}
