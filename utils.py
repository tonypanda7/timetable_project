import pandas as pd
from pandas.errors import EmptyDataError

def load_csv_to_db(file_path, db_model, db_session):
    """
    Reads a CSV file and loads its content into the specified database table.
    
    This function now deletes all existing data in the table before loading
    the new data and gracefully handles completely empty files.
    """
    try:
        # --- FIX: Delete all existing records from this table first ---
        db_session.query(db_model).delete()
        
        # Attempt to read the CSV file
        df = pd.read_csv(file_path)
        
        # If the dataframe is empty (e.g., only has headers), commit and return
        if df.empty:
            db_session.commit()
            print(f"✅ Processed file with no data for '{db_model.__tablename__}'. Table is now empty.")
            return

        # Convert dataframe to a list of dictionaries to insert
        records = df.to_dict(orient='records')
        
        # Insert the new data
        db_session.bulk_insert_mappings(db_model, records)
        db_session.commit()
        
        print(f"✅ Successfully loaded {len(records)} records from {file_path} into '{db_model.__tablename__}' table.")
        
    except EmptyDataError:
        # --- FIX: Specifically catch the error for a completely empty file ---
        # This is a valid state, especially for feedback. Commit the deletion.
        db_session.commit()
        print(f"✅ Cleared and processed empty file for '{db_model.__tablename__}'. Table is now empty.")

    except FileNotFoundError:
        print(f"❌ Error: The file {file_path} was not found.")
        db_session.rollback()
    except Exception as e:
        db_session.rollback()
        # Re-raise the exception to provide detailed error info in the console
        raise e

