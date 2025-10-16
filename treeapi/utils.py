import pandas as pd
import os

def build_tree_from_excel(file_path):
    """
    Reads Excel, converts flat or '/'-separated TAGs into paths,
    and builds a hierarchical tree structure.
    file_path can be a string path or a file-like object.
    """

    if isinstance(file_path, str) and not os.path.exists(file_path):
        raise FileNotFoundError(f"Excel file not found at {file_path}")

    # Load Excel - pick Sheet2 if available, else default first sheet
    xl = pd.ExcelFile(file_path)
    sheet_to_use = "Sheet2" if "Sheet2" in xl.sheet_names else xl.sheet_names[0]
    df = pd.read_excel(file_path, sheet_name=sheet_to_use)

    if "TagName" not in df.columns:
        raise ValueError("Missing required column: TagName")

    # Get unique tags
    IOTUnique = df["TagName"].dropna().unique()
    IOTUniquePathList = []

    def insert_char_at_positions(s, char, positions):
        """
        Inserts 'char' into string 's' at each index in 'positions'.
        """
        for offset, pos in enumerate(positions):
            if pos + offset < len(s):
                s = s[:pos + offset] + char + s[pos + offset:]
        return s

    for e in IOTUnique:
        if "/" in e:
            # New format → already a hierarchical path
            output_string = e
        else:
            # Old format → inject slashes at fixed positions
            output_string = insert_char_at_positions(
                e, "/", [4, 7, 10, 13, 16, 19, 22, 25]
            )
        IOTUniquePathList.append(output_string)

    # Replace in dataframe for consistency
    df["IOTPATH"] = IOTUniquePathList

    # ✅ Tree root
    tree = {"id": "root", "name": "root", "children": []}

    def insert_path(root, path_parts, row_meta):
        node = root
        for idx, part in enumerate(path_parts):
            if "children" not in node:
                node["children"] = []

            child = next((c for c in node["children"] if c["name"] == part), None)
            if not child:
                child = {
                    "id": f"{node['id']}/{part}" if node['id'] else part,
                    "name": part,
                    "children": [],
                    # Add node type based on level (last level is sensor)
                    "type": "sensor" if idx == len(path_parts) - 1 else [
                        "manufacturer", "segment", "site", "plant",
                        "function", "system", "machine", "stage"
                    ][min(idx, 7)]  # Use last type if deeper than 8 levels
                }
                node["children"].append(child)
            node = child

        # If this is a leaf node (sensor), add status
        if len(path_parts) > 0 and node == root["children"][-1]:
            node.update({
                **row_meta,
                "status": "online",  # You can modify this based on actual sensor status
                "type": "sensor"
            })

    # Walk over rows to build nested structure
    for _, row in df.iterrows():
        path_parts = row["IOTPATH"].split("/")
        meta = {"TagName": row["TagName"]}  # keep minimal metadata
        insert_path(tree, path_parts, meta)

    return tree


def populate_nodes_from_excel(file_path):
    """
    Populates the Node and Note models from Excel file.
    This is used during the one-time superuser upload.
    """
    from .models import Node, Note
    
    if isinstance(file_path, str) and not os.path.exists(file_path):
        raise FileNotFoundError(f"Excel file not found at {file_path}")
    
    # Load Excel - pick Sheet2 if available, else default first sheet
    xl = pd.ExcelFile(file_path)
    sheet_to_use = "Sheet2" if "Sheet2" in xl.sheet_names else xl.sheet_names[0]
    df = pd.read_excel(file_path, sheet_name=sheet_to_use)
    
    if "TagName" not in df.columns:
        raise ValueError("Missing required column: TagName")
    
    # Get unique tags
    IOTUnique = df["TagName"].dropna().unique()
    
    created_count = 0
    updated_count = 0
    
    def insert_char_at_positions(s, char, positions):
        """
        Inserts 'char' into string 's' at each index in 'positions'.
        """
        for offset, pos in enumerate(positions):
            if pos + offset < len(s):
                s = s[:pos + offset] + char + s[pos + offset:]
        return s
    
    for tag in IOTUnique:
        if "/" in tag:
            # New format → already a hierarchical path
            node_id = tag
        else:
            # Old format → inject slashes at fixed positions
            node_id = insert_char_at_positions(
                tag, "/", [4, 7, 10, 13, 16, 19, 22, 25]
            )
        
        # Create or get the node
        node, created = Node.objects.get_or_create(node_id=node_id)
        
        if created:
            created_count += 1
        else:
            updated_count += 1
    
    return {
        'created': created_count,
        'updated': updated_count,
        'total': created_count + updated_count
    }
