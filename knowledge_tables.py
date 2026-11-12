"""Geometry-preserving extraction for normal and tightly spaced ruled tables."""
import io
import re
from statistics import median

PARSER_VERSION = "geometry-tables-v2"

def numeric_label(value):
    return isinstance(value,str) and bool(re.fullmatch(r"[0-9]+",value.strip()))

def extract_tables(raw):
    try:
        import pdfplumber
    except ImportError:
        return {}
    result = {}
    previous = None
    previous_tail = None
    with pdfplumber.open(io.BytesIO(raw)) as pdf:
        for page_no,page in enumerate(pdf.pages,1):
            char_size = median([c["size"] for c in page.chars]) if page.chars else 12
            dense = char_size < 4
            options = {"snap_tolerance":.5,"join_tolerance":1,"intersection_tolerance":1,
                       "edge_min_length":1} if dense else {}
            tolerance = .5 if dense else 3
            tables = sorted(page.find_tables(options),key=lambda t:(t.bbox[1],t.bbox[0]))
            output = []
            previous_bottom = 0
            for index,table in enumerate(tables,1):
                x0,top,x1,bottom = table.bbox
                context_box = (0, previous_bottom, page.width,top)
                context = page.crop(context_box).extract_text(x_tolerance=tolerance,y_tolerance=tolerance) or ""
                contexts = [{"page":page_no,"bbox":context_box,"text":context}] if context.strip() else []
                values = table.extract(x_tolerance=tolerance,y_tolerance=tolerance)
                has_header = bool(values and values[0] and any(
                    word in (values[0][0] or "").lower() for word in ("年龄","year/age")))
                continuation = None
                if (not has_header and not context.strip() and previous and previous["columns"] and values and
                        numeric_label(values[0][0]) and
                        int(values[0][0]) == previous["last_year"]+1 and
                        len(values[0]) == len(previous["columns"]) and
                        all(abs(a-b)<1 for a,b in zip((x0,x1),previous["x_bounds"]))):
                    columns = previous["columns"]
                    contexts = previous["header_context"]
                    continuation = previous["ref"]
                else:
                    columns = values[0] if has_header else []
                    if has_header and not context.strip() and previous_tail and previous_tail["text"].strip():
                        contexts = [previous_tail]
                columns = [v.strip() if isinstance(v,str) else v for v in columns]
                rows = []
                for row_index,(layout,items) in enumerate(zip(table.rows,values),1):
                    row_label = items[0].strip() if numeric_label(items[0]) else None
                    rows.append({"row":row_index,"row_label":row_label,"cells":[
                        {"column":col+1,"bbox":box,"text":value,
                         "column_label":columns[col] if columns and col<len(columns) else None}
                        for col,(box,value) in enumerate(zip(layout.cells,items))]})
                compact = "".join(c["text"] for c in contexts)
                compact = re.sub(r"\s+","",compact)
                gender = re.search(r"(男性|女性)",compact)
                pay = re.search(r"([0-9]+)年交",compact)
                annuity_type = re.search(r"平准年金|增额年金",compact)
                item = {"table_id":f"p{page_no}-t{index}","page":page_no,"bbox":table.bbox,
                        "rows":rows,"columns":columns,"header_context":contexts,
                        "continuation_of":continuation,"parser_version":PARSER_VERSION,
                        "settings":options,"text_tolerance":tolerance,
                        "context_labels":{"gender":gender[0] if gender else None,
                                          "payment_years":int(pay[1]) if pay else None,
                                          "annuity_type":annuity_type[0] if annuity_type else None},
                        "header_review_required":True}
                output.append(item)
                years = [int(r["row_label"]) for r in rows if r["row_label"]]
                previous = {"columns":columns,"last_year":years[-1] if years else -1,
                            "x_bounds":(x0,x1),"header_context":contexts,
                            "ref":{"page":page_no,"table_id":item["table_id"]}}
                previous_bottom = bottom
            result[page_no] = output
            tail_box = (0,previous_bottom,page.width,page.height)
            previous_tail = {"page":page_no,"bbox":tail_box,
                             "text":page.crop(tail_box).extract_text(x_tolerance=tolerance,y_tolerance=tolerance) or ""}
    return result
