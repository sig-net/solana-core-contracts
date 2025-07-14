use anchor_lang::prelude::*;
use borsh::schema::{BorshSchema, Definition, Fields};

pub fn get_schema_json_bytes<T: BorshSchema>() -> Result<Vec<u8>> {
    let container = T::schema_container();

    // Convert to borsh-js format
    let schema_json = container_to_borsh_js_format(&container);

    // Convert to JSON bytes
    let json_bytes = serde_json::to_vec(&schema_json)
        .map_err(|_| crate::error::ErrorCode::SerializationError)?;

    const MAX_SCHEMA_SIZE: usize = 800;
    if json_bytes.len() > MAX_SCHEMA_SIZE {
        msg!(
            "Schema size {} exceeds max {}",
            json_bytes.len(),
            MAX_SCHEMA_SIZE
        );
        return Err(crate::error::ErrorCode::SchemaTooLarge.into());
    }

    Ok(json_bytes)
}

fn container_to_borsh_js_format(
    container: &borsh::schema::BorshSchemaContainer,
) -> serde_json::Value {
    // Get the root type's definition
    if let Some(definition) = container.definitions.get(&container.declaration) {
        definition_to_borsh_js_format(definition, &container.definitions)
    } else if is_primitive(&container.declaration) {
        // It's a primitive type
        serde_json::json!(container.declaration)
    } else {
        // Fallback
        serde_json::json!(container.declaration)
    }
}

fn definition_to_borsh_js_format(
    definition: &Definition,
    all_definitions: &std::collections::HashMap<String, Definition>,
) -> serde_json::Value {
    match definition {
        Definition::Array { length, elements } => {
            let elem_schema = get_schema_for_type(elements, all_definitions);
            serde_json::json!({
                "array": {
                    "type": elem_schema,
                    "len": length
                }
            })
        }
        Definition::Sequence { elements } => {
            let elem_schema = get_schema_for_type(elements, all_definitions);
            serde_json::json!({
                "array": {
                    "type": elem_schema
                }
            })
        }
        Definition::Tuple { elements } => {
            // borsh-js doesn't have tuples, use struct with numeric keys
            let mut fields = serde_json::Map::new();
            for (i, elem) in elements.iter().enumerate() {
                let elem_schema = get_schema_for_type(elem, all_definitions);
                fields.insert(i.to_string(), elem_schema);
            }
            serde_json::json!({ "struct": fields })
        }
        Definition::Enum { variants } => {
            let enum_variants: Vec<serde_json::Value> = variants
                .iter()
                .map(|(variant_name, type_name)| {
                    let variant_schema = get_schema_for_type(type_name, all_definitions);
                    let mut variant_obj = serde_json::Map::new();
                    variant_obj.insert(variant_name.clone(), variant_schema);
                    serde_json::json!({
                        "struct": variant_obj
                    })
                })
                .collect();
            serde_json::json!({ "enum": enum_variants })
        }
        Definition::Struct { fields } => match fields {
            Fields::NamedFields(named) => {
                let mut obj = serde_json::Map::new();
                for (field_name, field_type) in named {
                    let field_schema = get_schema_for_type(field_type, all_definitions);
                    obj.insert(field_name.clone(), field_schema);
                }
                serde_json::json!({ "struct": obj })
            }
            Fields::UnnamedFields(types) => {
                let mut obj = serde_json::Map::new();
                for (i, field_type) in types.iter().enumerate() {
                    let field_schema = get_schema_for_type(field_type, all_definitions);
                    obj.insert(i.to_string(), field_schema);
                }
                serde_json::json!({ "struct": obj })
            }
            Fields::Empty => {
                serde_json::json!({ "struct": {} })
            }
        },
    }
}

fn get_schema_for_type(
    type_name: &str,
    all_definitions: &std::collections::HashMap<String, Definition>,
) -> serde_json::Value {
    if is_primitive(type_name) {
        serde_json::json!(type_name)
    } else if let Some(def) = all_definitions.get(type_name) {
        definition_to_borsh_js_format(def, all_definitions)
    } else {
        serde_json::json!(type_name)
    }
}

fn is_primitive(type_name: &str) -> bool {
    matches!(
        type_name,
        "bool"
            | "u8"
            | "u16"
            | "u32"
            | "u64"
            | "u128"
            | "i8"
            | "i16"
            | "i32"
            | "i64"
            | "i128"
            | "f32"
            | "f64"
            | "string"
            | "nil"
    )
}
